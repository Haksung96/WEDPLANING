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
    const fb = cur.firebase || {};
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
        <input id="set-gmaps" type="text" placeholder="AIzaSy..." value="${esc(cur.googleMapsKey || '')}" />
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
  }

  function val(id) {
    return (document.getElementById(id)?.value || '').trim();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { loadAndApply, bind };
})();

// Apply saved settings BEFORE Firebase init
Settings.loadAndApply();

// =============================================================
// Auto-migrate stale Service Worker cache.
// If the cached config.js is the original placeholder (no API keys),
// fetch a fresh copy from the network with a cache-busting query
// (which bypasses the SW cache match), parse out the real keys, save
// them to localStorage, then reload. Runs at most once per session.
// =============================================================
(function autoMigrateStaleCache() {
  const ALREADY_KEY = 'wedplan:cache-migrated-v2';
  if (sessionStorage.getItem(ALREADY_KEY)) return;

  const placeholderMaps = !CONFIG.GOOGLE_MAPS_API_KEY ||
                          CONFIG.GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY';
  const placeholderFb = !CONFIG.FIREBASE || !CONFIG.FIREBASE.apiKey;

  if (!placeholderMaps && !placeholderFb) return;
  if (location.protocol === 'file:') return;   // local dev

  sessionStorage.setItem(ALREADY_KEY, '1');

  const bust = '/js/config.js?cb=' + Date.now();
  fetch(bust, { cache: 'no-store' })
    .then((r) => r.ok ? r.text() : Promise.reject(new Error('config fetch ' + r.status)))
    .then((text) => {
      let migrated = false;
      const mapsMatch = text.match(/GOOGLE_MAPS_API_KEY:\s*['"]([^'"]+)['"]/);
      const fbApiKey = text.match(/apiKey:\s*['"]([^'"]+)['"]/);
      const fbAuth = text.match(/authDomain:\s*['"]([^'"]+)['"]/);
      const fbProj = text.match(/projectId:\s*['"]([^'"]+)['"]/);
      const fbBucket = text.match(/storageBucket:\s*['"]([^'"]+)['"]/);
      const fbSender = text.match(/messagingSenderId:\s*['"]([^'"]+)['"]/);
      const fbAppId = text.match(/appId:\s*['"]([^'"]+)['"]/);

      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('wedplan:settings') || '{}'); } catch {}

      if (placeholderMaps && mapsMatch && mapsMatch[1] !== 'YOUR_GOOGLE_MAPS_API_KEY') {
        saved.googleMapsKey = mapsMatch[1];
        migrated = true;
      }
      if (placeholderFb && fbApiKey && fbProj) {
        saved.firebase = {
          apiKey: fbApiKey[1],
          authDomain: fbAuth ? fbAuth[1] : '',
          projectId: fbProj[1],
          storageBucket: fbBucket ? fbBucket[1] : '',
          messagingSenderId: fbSender ? fbSender[1] : '',
          appId: fbAppId ? fbAppId[1] : '',
        };
        migrated = true;
      }

      if (migrated) {
        localStorage.setItem('wedplan:settings', JSON.stringify(saved));
        // Reload so the freshly-saved keys are applied via Settings.loadAndApply().
        location.reload();
      }
    })
    .catch((err) => {
      console.warn('Auto-migration failed:', err);
    });
})();
