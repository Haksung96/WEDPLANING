// In-app settings — let users paste API keys without editing config.js.
// Stored in localStorage and merged into CONFIG on load.

const Settings = (() => {
  const KEY = 'wedplan:settings';

  function loadAndApply() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.googleMapsKey) CONFIG.GOOGLE_MAPS_API_KEY = saved.googleMapsKey;
      if (saved.firebase) CONFIG.FIREBASE = { ...CONFIG.FIREBASE, ...saved.firebase };
      if (saved.proximityRadius) CONFIG.PROXIMITY_RADIUS_METERS = Number(saved.proximityRadius);
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  }

  function getCurrent() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function save(values) {
    localStorage.setItem(KEY, JSON.stringify(values));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function render() {
    const cur = getCurrent();
    // Show EFFECTIVE values: localStorage overrides on top of CONFIG defaults.
    // After domain switch (Netlify → GitHub Pages), localStorage starts empty
    // but CONFIG still has the hardcoded keys, so the app works — just the
    // settings UI was misleadingly blank. Now it always shows what's actually
    // in use, and Save preserves any edits to localStorage.
    const mapsKey = cur.googleMapsKey || CONFIG.GOOGLE_MAPS_API_KEY || '';
    const fb = { ...(CONFIG.FIREBASE || {}), ...(cur.firebase || {}) };
    return `
      <div class="section-header">
        <h3>⚙️ 설정</h3>
        <p>API 키를 여기서 직접 입력할 수 있습니다. 기기 안에서만 저장됨.</p>
      </div>

      <div class="settings-card">
        <h4>🗺️ Google Maps API 키</h4>
        <p class="setting-hint">
          <a href="https://console.cloud.google.com/google/maps-apis" target="_blank">Google Cloud Console</a>에서 발급. Maps JavaScript API 활성화 필요.
        </p>
        <input id="set-gmaps" type="text" placeholder="AIzaSy..." value="${esc(mapsKey)}" />
      </div>

      <div class="settings-card">
        <h4>🔥 Firebase 설정</h4>
        <p class="setting-hint">
          <a href="https://console.firebase.google.com/" target="_blank">Firebase 콘솔</a> → 프로젝트 → 웹 앱 추가 → firebaseConfig 값 입력.
          비워두면 로컬 모드로 동작 (같은 기기 내에서만 동기화).
        </p>
        <label>apiKey</label>
        <input id="set-fb-apiKey" type="text" placeholder="AIzaSy..." value="${esc(fb.apiKey || '')}" />
        <label>authDomain</label>
        <input id="set-fb-authDomain" type="text" placeholder="myapp.firebaseapp.com" value="${esc(fb.authDomain || '')}" />
        <label>projectId</label>
        <input id="set-fb-projectId" type="text" placeholder="myapp" value="${esc(fb.projectId || '')}" />
        <label>storageBucket</label>
        <input id="set-fb-storageBucket" type="text" placeholder="myapp.appspot.com" value="${esc(fb.storageBucket || '')}" />
        <label>messagingSenderId</label>
        <input id="set-fb-messagingSenderId" type="text" value="${esc(fb.messagingSenderId || '')}" />
        <label>appId</label>
        <input id="set-fb-appId" type="text" value="${esc(fb.appId || '')}" />
        <details class="setting-paste">
          <summary>📋 firebaseConfig 통째로 붙여넣기</summary>
          <textarea id="set-fb-paste" placeholder='{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  ...
}'></textarea>
          <button id="set-fb-parse" class="btn-secondary">파싱해서 채우기</button>
        </details>
      </div>

      <div class="settings-card">
        <h4>📍 근접 알림 반경 (미터)</h4>
        <input id="set-radius" type="number" min="50" max="2000" step="50" value="${esc(cur.proximityRadius || CONFIG.PROXIMITY_RADIUS_METERS)}" />
      </div>

      <div class="settings-card">
        <h4>🔋 배터리 세이버 모드</h4>
        <p class="setting-hint">위치 추적의 정밀도를 낮추고 갱신 주기를 늘려 배터리를 아낍니다 (정확도 ±50m). 여행 중 보조배터리 없이 오래 사용할 때 권장.</p>
        <label class="toggle-row">
          <input type="checkbox" id="set-battery-saver" ${cur.batterySaver ? 'checked' : ''} />
          <span>저전력 위치 추적 사용</span>
        </label>
      </div>

      <div class="settings-card">
        <h4>🔍 Firebase 동기화 진단</h4>
        <p class="setting-hint">실시간 동기화가 안 될 때 여기서 점검:</p>
        <div id="sync-diag-summary" class="sync-diag-summary"></div>
        <div class="settings-buttons">
          <button id="sync-ping-btn" class="btn-primary">🔌 연결 테스트</button>
          <button id="sync-refresh-btn" class="btn-secondary">↻ 새로고침</button>
        </div>
        <pre id="sync-ping-result" class="sync-ping-result hidden"></pre>
      </div>

      <div class="settings-card">
        <h4>📡 오프라인 사용 가이드</h4>
        <p class="setting-hint">크루즈에서 데이터 로밍이 비싸거나 끊길 때를 대비해:</p>
        <ul class="offline-tips">
          <li><strong>한 번이라도 앱을 켜둔 페이지</strong>는 오프라인 자동 캐시됨 (PWA Service Worker).</li>
          <li><strong>일정·체크리스트·메모·지출</strong>은 오프라인에서도 입력/체크 가능. 다시 온라인이 되면 자동 동기화.</li>
          <li><strong>지도 타일</strong>은 Google Maps 정책상 오프라인 캐시 불가 → 항구 도착 직후 와이파이 잡힐 때 미리 한 번씩 도시 지도를 둘러보면 일부 타일 캐시됨.</li>
          <li><strong>장소 검색 / 경로</strong>은 인터넷 필요 — 호텔/카페 와이파이 활용.</li>
          <li><strong>승선 전 한 번 모든 일정을 펼쳐 보기</strong> → JS·CSS·이미지가 SW 캐시에 들어가 비행기·바다 위에서도 일정/팁/회화 열람 가능.</li>
          <li>크루즈 와이파이 패키지: MSC 'Browse' (메시지 + 기본 검색), 'Surf' (소셜·이메일 가능), 'Stream' (영상). 보통 'Browse' 면 충분.</li>
          <li>유럽 eSIM (Airalo·Holafly·Ubigi) 미리 설치 → 항구 입항 시 즉시 데이터 사용.</li>
        </ul>
      </div>

      <div class="settings-card">
        <h4>📱 핸드폰에 설치 / 와이프와 공유</h4>
        <p class="setting-hint">QR을 와이프 핸드폰으로 스캔하면 같은 앱이 열립니다. 하단 공유 → 홈 화면에 추가하면 1-클릭 실행 앱처럼 사용 가능.</p>
        <div class="qr-box">
          <img id="set-qr-img" src="" alt="QR 코드" />
          <div class="qr-info">
            <div><strong>트립 코드</strong>: <code>${esc(Sync.getUser().tripCode)}</code></div>
            <button id="set-share" class="btn-secondary" style="margin-top:8px;">URL 공유 / 복사</button>
            <a href="install.html" id="set-install-page" class="btn-secondary" style="margin-top:8px; display:inline-block; text-decoration:none;">설치 가이드 열기</a>
          </div>
        </div>
      </div>

      <div class="settings-buttons">
        <button id="set-save" class="btn-primary">저장 후 새로고침</button>
        <button id="set-reset" class="btn-secondary danger">초기화</button>
      </div>
    `;
  }

  function bind() {
    const root = document.getElementById('view-settings');
    if (!root) return;
    root.innerHTML = render();
    renderDiag();

    // Render QR code (free public API - no key required)
    const qrImg = document.getElementById('set-qr-img');
    if (qrImg) {
      const url = location.origin + location.pathname.replace(/index\.html.*$/, '');
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`;
    }

    document.getElementById('set-fb-parse')?.addEventListener('click', () => {
      const ta = document.getElementById('set-fb-paste');
      try {
        // Try JSON first, then JS object literal
        let cfg;
        const text = ta.value.trim();
        try { cfg = JSON.parse(text); }
        catch {
          // Strip JS-style "key:" → "\"key\":"
          const jsonish = text
            .replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":')
            .replace(/'/g, '"')
            .replace(/,\s*}/g, '}');
          cfg = JSON.parse(jsonish);
        }
        ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].forEach((k) => {
          if (cfg[k]) document.getElementById('set-fb-' + k).value = cfg[k];
        });
        ta.value = '';
        alert('파싱 완료. 아래 저장 누르세요.');
      } catch (err) {
        alert('파싱 실패. JSON 형식인지 확인하세요.\n' + err.message);
      }
    });

    document.getElementById('set-share')?.addEventListener('click', async () => {
      const url = location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: '허니문 가이드', url });
        } else {
          await navigator.clipboard.writeText(url);
          alert('URL이 복사되었습니다.\n' + url);
        }
      } catch {}
    });

    document.getElementById('set-save').addEventListener('click', () => {
      const values = {
        googleMapsKey: document.getElementById('set-gmaps').value.trim(),
        firebase: {
          apiKey: val('set-fb-apiKey'),
          authDomain: val('set-fb-authDomain'),
          projectId: val('set-fb-projectId'),
          storageBucket: val('set-fb-storageBucket'),
          messagingSenderId: val('set-fb-messagingSenderId'),
          appId: val('set-fb-appId'),
        },
        proximityRadius: Number(document.getElementById('set-radius').value) || 250,
        batterySaver: document.getElementById('set-battery-saver').checked,
      };
      save(values);
      alert('저장됨. 페이지를 새로고침합니다.');
      location.reload();
    });

    document.getElementById('set-reset').addEventListener('click', () => {
      if (!confirm('설정을 초기화 하시겠습니까? (트립 데이터는 유지됨)')) return;
      clear();
      alert('초기화됨. 새로고침합니다.');
      location.reload();
    });

    document.getElementById('sync-ping-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('sync-ping-btn');
      const out = document.getElementById('sync-ping-result');
      btn.disabled = true;
      btn.textContent = '🔌 테스트 중...';
      out.classList.remove('hidden');
      out.textContent = '연결 시도 중...';
      try {
        const result = await Sync.ping();
        if (result.ok) {
          out.textContent = `✅ 성공! 왕복 시간 ${result.roundtripMs}ms\n\n` +
            `테스트 문서가 'trips/${Sync.getUser().tripCode}/_ping/${Sync.getUser().name}' 에 기록됨.\n` +
            `같은 트립 코드 + 같은 인터넷이면 상대방 폰에서도 즉시 읽힙니다.`;
        } else {
          out.textContent = `❌ 실패: ${result.error}\n\n${result.hint || ''}`;
        }
      } catch (err) {
        out.textContent = `❌ 예외: ${err.message}`;
      } finally {
        btn.disabled = false;
        btn.textContent = '🔌 연결 테스트';
        renderDiag();
      }
    });

    document.getElementById('sync-refresh-btn')?.addEventListener('click', () => {
      renderDiag();
    });
  }

  function renderDiag() {
    const el = document.getElementById('sync-diag-summary');
    if (!el || typeof Sync === 'undefined') return;
    const d = Sync.getDiagnostics();
    const fmt = (ts) => ts ? new Date(ts).toLocaleString('ko-KR', { hour12: false }) : '없음';
    const initLabels = {
      ok: '✅ 정상', error: '❌ 실패', 'no-config': '⚠️ Firebase 설정 없음', pending: '⏳ 진행 중',
    };
    const persistLabels = {
      ok: '✅ 활성', 'multi-tab': '⚠️ 멀티탭 (1개 탭만)', unsupported: '⚠️ 지원 안 됨', unknown: '?',
    };
    el.innerHTML = `
      <div class="diag-row"><span>모드</span><strong>${d.mode === 'firebase' ? '🔥 Firebase' : '💾 로컬'}</strong></div>
      <div class="diag-row"><span>이름</span><strong>${esc(d.name)}</strong></div>
      <div class="diag-row"><span>트립 코드</span><strong>${esc(d.tripCode)}</strong></div>
      <div class="diag-row"><span>초기화</span><strong>${initLabels[d.initStatus] || d.initStatus}</strong></div>
      <div class="diag-row"><span>오프라인 캐시</span><strong>${persistLabels[d.persistence] || d.persistence}</strong></div>
      <div class="diag-row"><span>읽기 횟수</span><strong>${d.readCount}회</strong></div>
      <div class="diag-row"><span>마지막 읽기</span><strong>${fmt(d.lastReadAt)}</strong></div>
      <div class="diag-row"><span>쓰기 횟수</span><strong>${d.writeCount}회</strong></div>
      <div class="diag-row"><span>마지막 쓰기</span><strong>${fmt(d.lastWriteAt)}</strong></div>
      ${d.lastError ? `<div class="diag-row error"><span>마지막 에러</span><strong>${esc(d.lastError)}</strong></div>` : ''}
      ${d.initError ? `<div class="diag-row error"><span>초기화 에러</span><strong>${esc(d.initError)}</strong></div>` : ''}
      <div class="diag-hint">⚠️ 두 폰의 트립 코드가 정확히 같아야 동기화됩니다. 위 코드를 상대방 폰에서도 확인하세요.</div>
    `;
  }

  function val(id) {
    return (document.getElementById(id)?.value || '').trim();
  }

  const esc = Utils.escape;

  return { loadAndApply, bind };
})();

// Apply saved settings BEFORE Firebase init
Settings.loadAndApply();
