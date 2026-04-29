// Main app controller — login, navigation, today view, tips, notes.

const App = (() => {
  let currentDayIndex = 0;
  let progress = {};   // { 'YYYY-MM-DD-i': { done: bool } }
  let notesAutosaveTimer = null;
  let notesLocalDirty = false;

  function start() {
    bindLogin();
    autoLoginIfRemembered();
  }

  // -------- LOGIN --------
  function bindLogin() {
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('logout-btn').addEventListener('click', logout);
  }

  function autoLoginIfRemembered() {
    const saved = localStorage.getItem('wedplan:user');
    if (!saved) return;
    try {
      const { name, tripCode } = JSON.parse(saved);
      if (name && tripCode) {
        document.getElementById('user-name').value = name;
        document.getElementById('trip-code').value = tripCode;
        // Auto-login
        doLogin(name, tripCode);
      }
    } catch {}
  }

  function login() {
    const name = document.getElementById('user-name').value;
    const tripCode = document.getElementById('trip-code').value.trim();
    if (!tripCode) { alert('트립 코드를 입력하세요'); return; }
    localStorage.setItem('wedplan:user', JSON.stringify({ name, tripCode }));
    doLogin(name, tripCode);
  }

  function doLogin(name, tripCode) {
    Sync.init({ name, tripCode });

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Initialize subsystems
    Checklist.init();
    MapView.init();
    setupNavigation();
    setupNotes();
    renderTips();
    renderEmergency();
    renderDayPills();

    // Default to today (or trip start if today is outside range)
    setActiveDay(getDefaultDayIndex());

    // Subscribe to per-event progress (event check-offs)
    Sync.subscribe('progress', (items) => {
      progress = items;
      renderTodayView();
    });

    // Proximity dismiss
    document.getElementById('proximity-dismiss').addEventListener('click', () => {
      MapView.dismissBanner();
    });

    // Notification permission ask (deferred to first user interaction)
    askNotificationPermissionLazy();

    // PWA install hint (lazy)
    listenInstallPrompt();
  }

  function logout() {
    if (!confirm('로그아웃 하시겠습니까? (트립 코드는 다시 입력해야 합니다)')) return;
    localStorage.removeItem('wedplan:user');
    Sync.destroy();
    location.reload();
  }

  // -------- NAVIGATION --------
  function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
        // When switching to map, ensure markers reflect current day
        if (view === 'map') MapView.setDayIndex(currentDayIndex);
        // Update header
        updateHeader(view);
      });
    });
  }

  function updateHeader(view) {
    const day = TRIP.days[currentDayIndex];
    const dayLabel = document.getElementById('header-day');
    const txt = document.getElementById('header-text');
    if (view === 'today' || view === 'map') {
      dayLabel.textContent = `Day ${currentDayIndex + 1}`;
      txt.textContent = day ? `${day.title}` : '오늘의 일정';
    } else if (view === 'checklist') {
      dayLabel.textContent = '준비물';
      txt.textContent = '둘이서 함께 체크';
    } else if (view === 'tips') {
      dayLabel.textContent = '팁';
      txt.textContent = '주의사항 & 정보';
    } else if (view === 'notes') {
      dayLabel.textContent = '메모';
      txt.textContent = '공유 메모';
    }
  }

  // -------- DAY PILLS --------
  function getDefaultDayIndex() {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const idx = TRIP.days.findIndex((d) => d.date === todayStr);
    if (idx >= 0) return idx;
    // Before trip starts → first day. After trip → last day.
    if (today < new Date(TRIP.days[0].date)) return 0;
    return TRIP.days.length - 1;
  }

  function renderDayPills() {
    const root = document.getElementById('day-selector');
    root.innerHTML = '';
    const todayStr = new Date().toISOString().slice(0, 10);

    TRIP.days.forEach((day, i) => {
      const pill = document.createElement('button');
      pill.className = 'day-pill';
      if (i === currentDayIndex) pill.classList.add('active');
      if (day.date === todayStr) pill.classList.add('today');
      const md = day.date.slice(5).replace('-', '/');
      pill.innerHTML = `<span class="pill-date">${md}</span><span class="pill-day">(${day.weekday})</span>`;
      pill.addEventListener('click', () => setActiveDay(i));
      root.appendChild(pill);
    });
  }

  function setActiveDay(i) {
    currentDayIndex = i;
    renderDayPills();
    renderTodayView();
    MapView.setDayIndex(i);
    updateHeader('today');
  }

  // -------- TODAY VIEW --------
  function renderTodayView() {
    const day = TRIP.days[currentDayIndex];
    if (!day) return;

    const header = document.getElementById('day-header');
    header.innerHTML = `
      <h3>${esc(day.title)}</h3>
      <div class="day-sub">${esc(day.date)} (${esc(day.weekday)}) · ${esc(day.subtitle || '')}</div>
      ${day.tips ? `<div class="day-tip">💡 ${esc(day.tips)}</div>` : ''}
    `;

    const list = document.getElementById('events-list');
    list.innerHTML = '';
    day.events.forEach((evt, i) => {
      const key = `${day.date}-${i}`;
      const done = !!(progress[key] && progress[key].done);

      const card = document.createElement('div');
      card.className = `event-card tag-${evt.tag || ''}${done ? ' completed' : ''}`;
      const updatedBy = progress[key] && progress[key]._updatedBy ? progress[key]._updatedBy : null;
      card.innerHTML = `
        <div class="event-time">${esc(evt.time)}</div>
        <div class="event-body">
          <div class="event-title">${esc(evt.title)}</div>
          ${evt.desc ? `<div class="event-desc">${esc(evt.desc)}</div>` : ''}
          ${evt.location ? `<div class="event-desc" style="margin-top:6px;">📍 ${esc(evt.location.name)}</div>` : ''}
          <div class="event-actions">
            <button class="pill-btn ${done ? 'done' : ''}" data-toggle="${key}">${done ? `✓ 완료${updatedBy ? ' · ' + esc(updatedBy) : ''}` : '완료 체크'}</button>
            ${evt.location ? `<button class="pill-btn" data-nav='${JSON.stringify(evt.location).replace(/'/g, "&#39;")}'>🗺️ 지도</button>` : ''}
            ${evt.location ? `<button class="pill-btn" data-gmap='${JSON.stringify(evt.location).replace(/'/g, "&#39;")}'>↗️ Google 길찾기</button>` : ''}
          </div>
        </div>
      `;
      list.appendChild(card);
    });

    // Wire actions
    list.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => toggleEventDone(btn.dataset.toggle));
    });
    list.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelector('.nav-btn[data-view="map"]').click();
      });
    });
    list.querySelectorAll('[data-gmap]').forEach((btn) => {
      btn.addEventListener('click', () => {
        try {
          const loc = JSON.parse(btn.dataset.gmap.replace(/&#39;/g, "'"));
          openGoogleMaps(loc);
        } catch (err) { console.warn(err); }
      });
    });
  }

  function toggleEventDone(key) {
    const cur = progress[key] || {};
    Sync.setItem('progress', key, { done: !cur.done });
  }

  function openGoogleMaps(location) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name)}&query_place_id=${location.lat},${location.lng}`;
    window.open(url, '_blank');
  }

  // -------- TIPS VIEW --------
  function renderTips() {
    const root = document.getElementById('tips-content');
    root.innerHTML = '';
    TRAVEL_TIPS.forEach((cat) => {
      const div = document.createElement('div');
      div.className = 'tip-category';
      div.innerHTML = `
        <h4>${cat.icon} ${esc(cat.category)}</h4>
        <ul>${cat.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
      `;
      root.appendChild(div);
    });
  }

  function renderEmergency() {
    const root = document.getElementById('emergency-list');
    const labels = {
      korea_embassy_spain: '🇪🇸 주스페인 한국대사관',
      korea_embassy_italy: '🇮🇹 주이탈리아 한국대사관',
      korea_embassy_france: '🇫🇷 주프랑스 한국대사관',
      eu_emergency: '🚨 EU 긴급 (경찰/응급)',
      travel_insurance: '🏥 여행자보험',
    };
    root.innerHTML = '';
    Object.entries(TRIP.emergency).forEach(([k, v]) => {
      const div = document.createElement('div');
      div.className = 'em-item';
      const tel = v.replace(/[^\d+]/g, '');
      div.innerHTML = `<span>${labels[k] || k}</span><a href="tel:${tel}">${esc(v)}</a>`;
      root.appendChild(div);
    });
  }

  // -------- NOTES VIEW --------
  function setupNotes() {
    const ta = document.getElementById('shared-notes');
    const status = document.getElementById('notes-status');

    Sync.subscribeDoc('notes', (data) => {
      if (notesLocalDirty) return;   // don't overwrite while user is typing
      ta.value = data && data.text ? data.text : '';
      if (data && data._updatedBy) {
        status.textContent = `최근 저장: ${data._updatedBy} · ${formatTime(data._updatedAt)}`;
      }
    });

    ta.addEventListener('input', () => {
      notesLocalDirty = true;
      status.textContent = '입력 중...';
      clearTimeout(notesAutosaveTimer);
      notesAutosaveTimer = setTimeout(() => {
        Sync.setDoc('notes', { text: ta.value });
        notesLocalDirty = false;
        status.textContent = '저장됨';
      }, CONFIG.AUTOSAVE_DEBOUNCE);
    });

    ta.addEventListener('blur', () => {
      if (notesAutosaveTimer) {
        clearTimeout(notesAutosaveTimer);
        Sync.setDoc('notes', { text: ta.value });
        notesLocalDirty = false;
        status.textContent = '저장됨';
      }
    });
  }

  // -------- MISC --------
  function askNotificationPermissionLazy() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      // Wait until user interacts
      const ask = () => {
        Notification.requestPermission();
        document.removeEventListener('click', ask);
      };
      document.addEventListener('click', ask, { once: true });
    }
  }

  let deferredPrompt = null;
  function listenInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      // Could show a custom button here later.
    });
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { start };
})();

// Boot
window.addEventListener('DOMContentLoaded', () => App.start());
