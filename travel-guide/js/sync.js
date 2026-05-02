// Firestore real-time sync between two travelers.
// Falls back to localStorage if Firebase is not configured.

const Sync = (() => {
  let db = null;
  let tripDoc = null;
  let listeners = [];
  let mode = 'local';   // 'firebase' | 'local'
  let unsubscribers = [];
  let user = { name: '남편', tripCode: '971003' };
  // Diagnostics — surfaced in Settings → Firebase 진단
  let diag = {
    initStatus: 'pending',     // 'ok' | 'error' | 'no-config' | 'pending'
    initError: null,
    persistence: 'unknown',    // 'ok' | 'multi-tab' | 'unsupported' | 'unknown'
    firstReadAt: null,
    lastReadAt: null,
    lastWriteAt: null,
    lastError: null,
    readCount: 0,
    writeCount: 0,
  };

  function init(opts) {
    user = { ...user, ...opts };

    if (isFirebaseConfigured()) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(CONFIG.FIREBASE);
        db = firebase.firestore();
        // enablePersistence returns a Promise in modern SDKs. Must be
        // called BEFORE any other Firestore call. Failure modes:
        //   - 'failed-precondition' → multi-tab open (still works without cache)
        //   - 'unimplemented' → browser doesn't support IndexedDB
        // Either is non-fatal; sync still works online.
        try {
          const r = db.enablePersistence({ synchronizeTabs: true });
          if (r && typeof r.then === 'function') {
            r.then(() => { diag.persistence = 'ok'; })
             .catch((err) => {
               diag.persistence = err && err.code === 'failed-precondition' ? 'multi-tab' : 'unsupported';
             });
          } else {
            diag.persistence = 'ok';
          }
        } catch (persistErr) {
          diag.persistence = 'unsupported';
        }
        tripDoc = db.collection('trips').doc(user.tripCode);
        mode = 'firebase';
        diag.initStatus = 'ok';
        // Don't claim 'online' until a real snapshot succeeds. Start neutral.
        setStatus('syncing');

        window.addEventListener('online', () => {
          if (mode === 'firebase' && diag.lastError == null) setStatus('online');
        });
        window.addEventListener('offline', () => setStatus('offline'));
      } catch (err) {
        console.warn('Firebase init failed, falling back to local:', err);
        diag.initStatus = 'error';
        diag.initError = err && err.message ? err.message : String(err);
        mode = 'local';
        setStatus('offline');
      }
    } else {
      diag.initStatus = 'no-config';
      mode = 'local';
      setStatus('offline');
    }

    return mode;
  }

  function setStatus(status) {
    const badge = document.getElementById('sync-status');
    if (!badge) return;
    badge.classList.remove('online', 'offline', 'syncing', 'error');
    badge.classList.add(status);
    const titles = {
      online: '✅ 실시간 동기화 중',
      syncing: '⏳ 동기화 중...',
      offline: '⚠️ 오프라인 (로컬에 저장, 재접속 시 자동 동기화)',
      error: '🚫 동기화 실패 — 설정 → Firebase 진단 확인',
    };
    badge.title = titles[status] || status;
  }

  function getDiagnostics() {
    return { ...diag, mode, tripCode: user.tripCode, name: user.name };
  }

  // -------- Subscribe --------
  // collection: 'checklist' | 'notes' | 'events' | 'progress'
  function subscribe(collection, callback) {
    if (mode === 'firebase') {
      const unsub = tripDoc.collection(collection).onSnapshot(
        (snap) => {
          const items = {};
          snap.forEach((doc) => { items[doc.id] = doc.data(); });
          diag.lastReadAt = Date.now();
          if (!diag.firstReadAt) diag.firstReadAt = diag.lastReadAt;
          diag.readCount++;
          diag.lastError = null;
          if (navigator.onLine) setStatus('online');
          callback(items);
        },
        (err) => {
          console.warn('Sync error:', collection, err);
          diag.lastError = `${collection}: ${err.code || err.message}`;
          setStatus('error');
          // Fall back to local so the app stays usable
          const local = readLocal(collection);
          callback(local);
        }
      );
      unsubscribers.push(unsub);
    } else {
      callback(readLocal(collection));
      listeners.push({ collection, callback });
    }
  }

  // -------- Single doc sync (notes) --------
  function subscribeDoc(docName, callback) {
    if (mode === 'firebase') {
      const unsub = tripDoc.collection('singletons').doc(docName).onSnapshot(
        (snap) => {
          diag.lastReadAt = Date.now();
          diag.readCount++;
          diag.lastError = null;
          callback(snap.exists ? snap.data() : null);
        },
        (err) => {
          console.warn('Doc sync error:', docName, err);
          diag.lastError = `singletons/${docName}: ${err.code || err.message}`;
          setStatus('error');
          callback(readLocalDoc(docName));
        }
      );
      unsubscribers.push(unsub);
    } else {
      callback(readLocalDoc(docName));
      listeners.push({ doc: docName, callback });
    }
  }

  // -------- Write --------
  async function setItem(collection, id, data) {
    setStatus('syncing');
    const enriched = {
      ...data,
      _updatedBy: user.name,
      _updatedAt: Date.now(),
    };

    if (mode === 'firebase') {
      try {
        await tripDoc.collection(collection).doc(id).set(enriched, { merge: true });
        diag.lastWriteAt = Date.now();
        diag.writeCount++;
        diag.lastError = null;
        setStatus('online');
      } catch (err) {
        console.warn('setItem failed:', collection, id, err);
        diag.lastError = `setItem ${collection}/${id}: ${err.code || err.message}`;
        setStatus('error');
        writeLocal(collection, id, enriched);
      }
    } else {
      writeLocal(collection, id, enriched);
      notifyLocal(collection);
    }
  }

  async function deleteItem(collection, id) {
    if (mode === 'firebase') {
      try {
        await tripDoc.collection(collection).doc(id).delete();
        diag.lastWriteAt = Date.now();
        diag.writeCount++;
      } catch (err) {
        console.warn('deleteItem failed:', collection, id, err);
        diag.lastError = `deleteItem ${collection}/${id}: ${err.code || err.message}`;
        setStatus('error');
      }
    } else {
      const all = readLocal(collection);
      delete all[id];
      localStorage.setItem(localKey(collection), JSON.stringify(all));
      notifyLocal(collection);
    }
  }

  async function setDoc(docName, data) {
    setStatus('syncing');
    const enriched = { ...data, _updatedBy: user.name, _updatedAt: Date.now() };

    if (mode === 'firebase') {
      try {
        await tripDoc.collection('singletons').doc(docName).set(enriched, { merge: true });
        diag.lastWriteAt = Date.now();
        diag.writeCount++;
        diag.lastError = null;
        setStatus('online');
      } catch (err) {
        console.warn('setDoc failed:', docName, err);
        diag.lastError = `setDoc ${docName}: ${err.code || err.message}`;
        setStatus('error');
        writeLocalDoc(docName, enriched);
      }
    } else {
      writeLocalDoc(docName, enriched);
      notifyLocalDoc(docName);
    }
  }

  // -------- Diagnostic test write/read --------
  async function ping() {
    if (mode !== 'firebase') {
      return { ok: false, mode, error: 'Firebase 미설정 (로컬 모드)' };
    }
    const t = Date.now();
    const id = 'ping_' + user.name;
    try {
      await tripDoc.collection('_ping').doc(id).set({
        by: user.name,
        at: t,
      });
      const snap = await tripDoc.collection('_ping').doc(id).get();
      const data = snap.data();
      return { ok: true, roundtripMs: Date.now() - t, value: data };
    } catch (err) {
      return { ok: false, error: err.code || err.message, hint: hintForError(err) };
    }
  }

  function hintForError(err) {
    const code = (err && err.code) || '';
    if (code.includes('permission-denied')) {
      return 'Firestore 보안 규칙이 막고 있습니다. Firebase 콘솔 → Firestore Database → 규칙 → 아래 내용 붙여넣기:\n\nrules_version = "2";\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /trips/{tripCode}/{document=**} {\n      allow read, write: if true;\n    }\n  }\n}';
    }
    if (code.includes('unavailable')) {
      return '인터넷 연결을 확인하세요.';
    }
    if (code.includes('unauthenticated')) {
      return '인증 규칙이 활성화되어 있습니다. 위와 같이 규칙을 단순화하거나 Anonymous Auth 를 활성화하세요.';
    }
    return '에러 메시지를 그대로 복사해서 알려주세요.';
  }

  // -------- Local storage helpers --------
  function localKey(collection) {
    return `wedplan:${user.tripCode}:${collection}`;
  }

  function readLocal(collection) {
    try {
      const raw = localStorage.getItem(localKey(collection));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function writeLocal(collection, id, data) {
    const all = readLocal(collection);
    all[id] = data;
    localStorage.setItem(localKey(collection), JSON.stringify(all));
  }

  function readLocalDoc(docName) {
    try {
      const raw = localStorage.getItem(`${localKey('singletons')}:${docName}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function writeLocalDoc(docName, data) {
    localStorage.setItem(`${localKey('singletons')}:${docName}`, JSON.stringify(data));
  }

  function notifyLocal(collection) {
    const all = readLocal(collection);
    listeners.filter((l) => l.collection === collection).forEach((l) => l.callback(all));
  }

  function notifyLocalDoc(docName) {
    const data = readLocalDoc(docName);
    listeners.filter((l) => l.doc === docName).forEach((l) => l.callback(data));
  }

  function getMode() { return mode; }
  function getUser() { return { ...user }; }

  function destroy() {
    unsubscribers.forEach((u) => { try { u(); } catch {} });
    unsubscribers = [];
    listeners = [];
  }

  return {
    init, subscribe, subscribeDoc, setItem, deleteItem, setDoc,
    getMode, getUser, destroy, getDiagnostics, ping,
  };
})();
