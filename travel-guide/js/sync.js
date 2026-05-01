// Firestore real-time sync between two travelers.
// Falls back to localStorage if Firebase is not configured.

const Sync = (() => {
  let db = null;
  let tripDoc = null;
  let listeners = [];
  let mode = 'local';   // 'firebase' | 'local'
  let unsubscribers = [];
  let user = { name: '남편', tripCode: '971003' };

  function init(opts) {
    user = { ...user, ...opts };

    if (isFirebaseConfigured()) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(CONFIG.FIREBASE);
        db = firebase.firestore();
        // Enable IndexedDB persistence so reads/writes work offline and
        // re-sync once connectivity returns. Must be called BEFORE any
        // other Firestore call. Safe to fail (multi-tab returns 'failed-precondition').
        try {
          db.enablePersistence({ synchronizeTabs: true });
        } catch (persistErr) {
          // Older SDKs throw synchronously; newer ones return a promise — ignore.
        }
        tripDoc = db.collection('trips').doc(user.tripCode);
        mode = 'firebase';
        setStatus(navigator.onLine ? 'online' : 'offline');

        window.addEventListener('online', () => setStatus('online'));
        window.addEventListener('offline', () => setStatus('offline'));
      } catch (err) {
        console.warn('Firebase init failed, falling back to local:', err);
        mode = 'local';
        setStatus('offline');
      }
    } else {
      mode = 'local';
      setStatus('offline');
    }

    return mode;
  }

  function setStatus(status) {
    const badge = document.getElementById('sync-status');
    if (!badge) return;
    badge.classList.remove('online', 'offline', 'syncing');
    badge.classList.add(status);
    badge.title = status === 'online' ? '실시간 동기화 중' : status === 'syncing' ? '동기화 중...' : '로컬 모드';
  }

  // -------- Subscribe --------
  // collection: 'checklist' | 'notes' | 'events' | 'progress'
  function subscribe(collection, callback) {
    if (mode === 'firebase') {
      const unsub = tripDoc.collection(collection).onSnapshot(
        (snap) => {
          const items = {};
          snap.forEach((doc) => { items[doc.id] = doc.data(); });
          callback(items);
        },
        (err) => {
          console.warn('Sync error:', err);
          setStatus('offline');
          // Fall back to local
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
        (snap) => callback(snap.exists ? snap.data() : null),
        (err) => {
          console.warn('Doc sync error:', err);
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
        setStatus('online');
      } catch (err) {
        console.warn('setItem failed:', err);
        setStatus('offline');
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
      } catch (err) {
        console.warn('deleteItem failed:', err);
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
        setStatus('online');
      } catch (err) {
        console.warn('setDoc failed:', err);
        setStatus('offline');
        writeLocalDoc(docName, enriched);
      }
    } else {
      writeLocalDoc(docName, enriched);
      notifyLocalDoc(docName);
    }
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

  return { init, subscribe, subscribeDoc, setItem, deleteItem, setDoc, getMode, getUser, destroy };
})();
