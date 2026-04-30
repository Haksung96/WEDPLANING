// Main app controller — login, navigation, today view, tips, notes.

const App = (() => {
  let currentDayIndex = 0;
  let progress = {};   // { 'YYYY-MM-DD-i': { done: bool } }
  let notesAutosaveTimer = null;
  let notesLocalDirty = false;

  function start() {
    bindLogin();
    autoLoginIfRemembered();
    showIosInstallHintIfNeeded();
  }

  function showIosInstallHintIfNeeded() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('wedplan:ios-hint-dismissed');
    if (!isIOS || isStandalone || dismissed) return;

    const hint = document.getElementById('ios-install-hint');
    if (!hint) return;
    setTimeout(() => hint.classList.remove('hidden'), 1500);
    document.getElementById('iih-close').addEventListener('click', () => {
      hint.classList.add('hidden');
      localStorage.setItem('wedplan:ios-hint-dismissed', '1');
    });
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
    Expenses.init();
    MapView.init();
    setupNavigation();
    setupNotes();
    renderTips();
    renderEmergency();
    renderPhrases();
    renderDayPills();
    startClock();
    showOnboardingIfNeeded();
    Mobile.bindHaptic();
    Mobile.disableDoubleTapZoom();
    Mobile.bindSwipe(
      () => navigateDay(+1),   // swipe left → next day
      () => navigateDay(-1),   // swipe right → prev day
    );

    // Re-boarding countdown — only updates when viewing today
    Reboarding.start(
      () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const day = TRIP.days[currentDayIndex];
        return day && day.date === todayStr ? day : null;
      },
      renderReboardingBanner
    );

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
        if (view === 'more') {
          document.getElementById('more-menu').classList.remove('hidden');
          return;
        }
        showView(view, btn);
      });
    });

    // More menu items
    document.querySelectorAll('.more-item[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        showView(btn.dataset.view);
        document.getElementById('more-menu').classList.add('hidden');
      });
    });
    document.querySelectorAll('[data-close-more]').forEach((el) => {
      el.addEventListener('click', () => {
        document.getElementById('more-menu').classList.add('hidden');
      });
    });
  }

  function showView(view, btn) {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active',
      btn ? b === btn : b.dataset.view === view));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    if (view === 'map') MapView.setDayIndex(currentDayIndex);
    if (view === 'expenses') Expenses.bind();
    if (view === 'settings') Settings.bind();
    updateHeader(view);
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
    } else if (view === 'expenses') {
      dayLabel.textContent = '지출';
      txt.textContent = '여행 지출 기록';
    } else if (view === 'phrases') {
      dayLabel.textContent = '회화';
      txt.textContent = '여행 필수 표현';
    } else if (view === 'settings') {
      dayLabel.textContent = '설정';
      txt.textContent = 'API 키 / 공유';
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
    const todayIdx = TRIP.days.findIndex((d) => d.date === todayStr);

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

    // Show "Today" jump button only when not viewing today (and today is in range)
    const jumpBtn = document.getElementById('jump-today-btn');
    if (jumpBtn) {
      if (todayIdx >= 0 && todayIdx !== currentDayIndex) {
        jumpBtn.classList.remove('hidden');
        jumpBtn.onclick = () => setActiveDay(todayIdx);
      } else {
        jumpBtn.classList.add('hidden');
      }
    }
  }

  function setActiveDay(i) {
    currentDayIndex = i;
    renderDayPills();
    // Reset auto-scroll flag so we re-scroll to active card on day change
    const list = document.getElementById('events-list');
    if (list) delete list.dataset.scrolled;
    renderTodayView();
    MapView.setDayIndex(i);
    updateHeader('today');
    // Scroll active day pill into view horizontally
    requestAnimationFrame(() => {
      const active = document.querySelector('.day-pill.active');
      if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  function navigateDay(delta) {
    const next = currentDayIndex + delta;
    if (next < 0 || next >= TRIP.days.length) return;
    setActiveDay(next);
  }

  // -------- TODAY VIEW --------
  function renderTodayView() {
    const day = TRIP.days[currentDayIndex];
    if (!day) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = day.date === todayStr;
    const nowMin = nowMinutes();

    // Compute active/next event indices (only meaningful for "today")
    let activeIdx = -1, nextIdx = -1;
    if (isToday) {
      day.events.forEach((evt, i) => {
        const m = parseTimeToMin(evt.time);
        if (m == null) return;
        if (m <= nowMin) activeIdx = i;
        if (m > nowMin && nextIdx === -1) nextIdx = i;
      });
    }

    const header = document.getElementById('day-header');
    let nextBadge = '';
    if (isToday && nextIdx >= 0) {
      const nextEvt = day.events[nextIdx];
      const minsUntil = parseTimeToMin(nextEvt.time) - nowMin;
      nextBadge = `<div class="next-up">⏭️ 다음: <strong>${esc(nextEvt.time)} ${esc(nextEvt.title)}</strong> · ${formatCountdown(minsUntil)} 후</div>`;
    }
    header.innerHTML = `
      <h3>${esc(day.title)}${isToday ? ' <span class="now-tag">NOW</span>' : ''}</h3>
      <div class="day-sub">${esc(day.date)} (${esc(day.weekday)}) · ${esc(day.subtitle || '')}</div>
      ${day.tips ? `<div class="day-tip">💡 ${esc(day.tips)}</div>` : ''}
      ${nextBadge}
    `;

    renderQuickGlance(day, isToday);

    // First-time swipe hint
    if (!localStorage.getItem('wedplan:swipe-hint-shown')) {
      const hint = document.createElement('div');
      hint.className = 'swipe-hint';
      hint.innerHTML = '👆 좌우 스와이프로 다른 날짜 이동';
      header.appendChild(hint);
      setTimeout(() => hint.classList.add('show'), 100);
      setTimeout(() => {
        hint.classList.remove('show');
        setTimeout(() => hint.remove(), 300);
        localStorage.setItem('wedplan:swipe-hint-shown', '1');
      }, 4000);
    }

    const list = document.getElementById('events-list');
    list.innerHTML = '';
    day.events.forEach((evt, i) => {
      const key = `${day.date}-${i}`;
      const done = !!(progress[key] && progress[key].done);
      const isActive = isToday && i === activeIdx && !done;
      const isNext = isToday && i === nextIdx;

      const card = document.createElement('div');
      const cls = ['event-card', `tag-${evt.tag || ''}`];
      if (done) cls.push('completed');
      if (isActive) cls.push('active');
      if (isNext) cls.push('next');
      card.className = cls.join(' ');

      const updatedBy = progress[key] && progress[key]._updatedBy ? progress[key]._updatedBy : null;
      const stateBadge = isActive ? '<span class="state-badge now">진행중</span>' :
                         isNext ? '<span class="state-badge next">다음</span>' : '';
      card.innerHTML = `
        <div class="event-time">${esc(evt.time)}</div>
        <div class="event-body">
          <div class="event-title">${stateBadge}${esc(evt.title)}</div>
          ${evt.desc ? `<div class="event-desc">${esc(evt.desc)}</div>` : ''}
          ${evt.location ? `<div class="event-desc" style="margin-top:6px;">📍 ${esc(evt.location.name)}</div>` : ''}
          <div class="event-actions">
            <button class="pill-btn ${done ? 'done' : ''}" data-toggle="${key}">${done ? `✓ 완료${updatedBy ? ' · ' + esc(updatedBy) : ''}` : '완료 체크'}</button>
            ${evt.location ? `<button class="pill-btn" data-nav='${JSON.stringify(evt.location).replace(/'/g, "&#39;")}'>🗺️ 지도</button>` : ''}
            ${evt.location ? `<button class="pill-btn primary" data-route='${JSON.stringify(evt.location).replace(/'/g, "&#39;")}'>🚦 경로</button>` : ''}
            ${evt.location ? `<button class="pill-btn" data-gmap='${JSON.stringify(evt.location).replace(/'/g, "&#39;")}'>↗️ Google 지도에서 보기</button>` : ''}
          </div>
        </div>
      `;
      list.appendChild(card);
    });

    // Auto-scroll to active/next on first paint of today
    if (isToday && !list.dataset.scrolled) {
      const target = list.querySelector('.event-card.active') || list.querySelector('.event-card.next');
      if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
      list.dataset.scrolled = '1';
    }

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
    list.querySelectorAll('[data-route]').forEach((btn) => {
      btn.addEventListener('click', () => {
        try {
          const loc = JSON.parse(btn.dataset.route.replace(/&#39;/g, "'"));
          if (typeof Directions !== 'undefined') Directions.open(loc);
        } catch (err) { console.warn(err); }
      });
    });
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function parseTimeToMin(timeStr) {
    if (!timeStr) return null;
    // "20:30" or "08:30" or "13:00 ~ 14:00" — first time wins
    const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function formatCountdown(mins) {
    if (mins < 0) return '지남';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
  }

  let clockTimer = null;
  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      const today = TRIP.days[currentDayIndex];
      if (!today) return;
      const todayStr = new Date().toISOString().slice(0, 10);
      if (today.date === todayStr) renderTodayView();
    }, 60000);   // every minute
  }

  function toggleEventDone(key) {
    const cur = progress[key] || {};
    Sync.setItem('progress', key, { done: !cur.done });
  }

  function openGoogleMaps(location) {
    // Search by place NAME so Google Maps shows the place card (reviews,
    // photos, hours, transit/taxi options) instead of just dropping a pin
    // at coords. We append the city for disambiguation, and fall back to
    // the lat/lng pair if no name is available.
    const day = TRIP.days[currentDayIndex];
    const cityHint = day && day.city ? ' ' + day.city : '';
    const query = location.name
      ? `${location.name}${cityHint}`
      : `${location.lat},${location.lng}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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

  let lastReboardingNotifiedKey = null;
  function renderReboardingBanner(state) {
    const banner = document.getElementById('reboarding-banner');
    const countdown = document.getElementById('rb-countdown');
    const meta = document.getElementById('rb-meta');
    if (!banner) return;

    if (!state) {
      banner.classList.add('hidden');
      banner.classList.remove('warning', 'critical', 'past');
      return;
    }

    banner.classList.remove('hidden', 'warning', 'critical', 'past');
    banner.classList.add(state.urgency);

    const fmt = (mins) => {
      if (mins < 0) return `지났음 (${Math.abs(mins)}분 초과)`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h === 0) return `${m}분 남음`;
      return `${h}시간 ${m}분 남음`;
    };
    countdown.textContent = fmt(state.minsUntil);
    meta.textContent = `${state.time} · ${state.title}`;

    // Notify on threshold crossings (60 / 30 / 15 min)
    const day = TRIP.days[currentDayIndex];
    const thresholds = [60, 30, 15, 5];
    thresholds.forEach((t) => {
      if (state.minsUntil > 0 && state.minsUntil <= t && state.minsUntil > t - 1) {
        const key = `${day.date}-${t}`;
        if (lastReboardingNotifiedKey !== key) {
          lastReboardingNotifiedKey = key;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🛳️ 재승선 알림', {
              body: `${state.minsUntil}분 후 ${state.title}. 지금 항구로 이동하세요.`,
              icon: 'icons/icon-192.png',
            });
          }
          if (typeof Mobile !== 'undefined') {
            Mobile.tap(t <= 30 ? 'error' : 'success');
          }
        }
      }
    });
  }

  function showOnboardingIfNeeded() {
    const banner = document.getElementById('onboarding-banner');
    const title = document.getElementById('onb-title');
    const desc = document.getElementById('onb-desc');
    const action = document.getElementById('onb-action');
    const dismiss = document.getElementById('onb-dismiss');
    if (!banner) return;

    const dismissed = sessionStorage.getItem('wedplan:onboarding-dismissed');
    if (dismissed) return;

    const isFile = location.protocol === 'file:';
    const noMaps = !isMapsConfigured();
    const noFirebase = !isFirebaseConfigured();

    let lines = [];
    if (isFile) {
      lines.push('파일 직접 열기는 일부 기능 제한. 시작하기.bat 사용 권장.');
    }
    if (noMaps && noFirebase) {
      lines.push('지도 + 실시간 공유 사용하려면 설정에서 API 키 입력 필요.');
    } else if (noMaps) {
      lines.push('지도 기능을 사용하려면 Google Maps API 키 필요.');
    } else if (noFirebase) {
      lines.push('둘이서 실시간 공유하려면 Firebase 설정 필요. (현재는 로컬 모드)');
    }

    if (lines.length === 0) return;

    title.textContent = isFile ? 'file:// 으로 열림' : '설정이 필요해요';
    desc.textContent = lines.join(' ');
    banner.classList.remove('hidden');

    action.onclick = () => {
      banner.classList.add('hidden');
      showView('settings');
    };
    dismiss.onclick = () => {
      banner.classList.add('hidden');
      sessionStorage.setItem('wedplan:onboarding-dismissed', '1');
    };
  }

  function renderQuickGlance(day, isToday) {
    const root = document.getElementById('quick-glance');
    if (!root) return;
    if (!isToday) {
      root.classList.add('hidden');
      return;
    }

    const total = day.events.length;
    const done = day.events.filter((_, i) => progress[`${day.date}-${i}`]?.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    root.classList.remove('hidden');
    root.innerHTML = `
      <div class="qg-row">
        <div class="qg-progress">
          <div class="qg-bar"><div class="qg-fill" style="width:${pct}%"></div></div>
          <div class="qg-meta">오늘 진행: <strong>${done}/${total}</strong> (${pct}%)</div>
        </div>
        <div id="qg-weather" class="qg-weather">
          <span class="qg-icon">⏳</span>
          <span class="qg-temp">날씨 로딩...</span>
        </div>
      </div>
    `;

    if (day.cityCenter) {
      Weather.getDayForecast(day.date, day.cityCenter.lat, day.cityCenter.lng).then((w) => {
        const el = document.getElementById('qg-weather');
        if (!el) return;
        if (!w) {
          el.innerHTML = '<span class="qg-icon">🌐</span><span class="qg-temp">날씨 정보 없음</span>';
          return;
        }
        const wd = Weather.describe(w.weatherCode);
        el.innerHTML = `
          <span class="qg-icon" title="${wd.text}">${wd.icon}</span>
          <div class="qg-tempbox">
            <strong>${w.tempMax}° / ${w.tempMin}°</strong>
            <small>강수 ${w.rainChance ?? 0}% · 일출 ${Weather.formatTime(w.sunrise)} 일몰 ${Weather.formatTime(w.sunset)}</small>
          </div>
        `;
      });
    }
  }

  function renderPhrases() {
    const root = document.getElementById('view-phrases');
    if (!root) return;
    let html = `
      <div class="section-header">
        <h3>🗣️ 여행 회화</h3>
        <p>한국어 → 🇪🇸 스페인어 / 🇮🇹 이탈리아어 / 🇫🇷 프랑스어</p>
      </div>
    `;
    PHRASES.forEach((cat) => {
      html += `<div class="phrase-cat"><h4>${esc(cat.category)}</h4>`;
      cat.items.forEach((p) => {
        html += `
          <div class="phrase-row">
            <div class="phrase-ko">${esc(p.ko)}</div>
            <div class="phrase-tr"><span class="flag">🇪🇸</span> ${esc(p.es)}</div>
            <div class="phrase-tr"><span class="flag">🇮🇹</span> ${esc(p.it)}</div>
            <div class="phrase-tr"><span class="flag">🇫🇷</span> ${esc(p.fr)}</div>
          </div>
        `;
      });
      html += '</div>';
    });
    root.innerHTML = html;
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
      // Show a subtle Install button in the proximity-banner area
      showInstallChip();
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      const chip = document.getElementById('install-chip');
      if (chip) chip.remove();
    });
  }

  function showInstallChip() {
    if (document.getElementById('install-chip')) return;
    const chip = document.createElement('button');
    chip.id = 'install-chip';
    chip.className = 'install-chip';
    chip.innerHTML = '📲 앱으로 설치';
    chip.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') chip.remove();
      deferredPrompt = null;
    });
    document.body.appendChild(chip);
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

  function getCurrentDayIndex() {
    return currentDayIndex;
  }

  return { start, getCurrentDayIndex };
})();

// Boot
window.addEventListener('DOMContentLoaded', () => App.start());
