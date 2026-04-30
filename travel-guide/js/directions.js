// Directions panel — show walking / transit / driving / taxi routes
// from current location to a chosen destination, using Google Directions API.

const Directions = (() => {
  const SHEET_ID = 'directions-sheet';

  // Per-tab cache for the currently open destination so flipping between
  // tabs doesn't re-hit the Directions API.
  let cache = {};
  let currentDest = null;
  let currentMode = 'WALKING';

  function open(location, opts = {}) {
    if (!location) return;
    currentDest = location;
    cache = {};
    currentMode = opts.defaultMode || 'WALKING';

    ensureSheet();
    const sheet = document.getElementById(SHEET_ID);
    sheet.classList.remove('hidden');
    renderHeader();
    renderTabs();
    fetchAndRender(currentMode);
  }

  function close() {
    const sheet = document.getElementById(SHEET_ID);
    if (sheet) sheet.classList.add('hidden');
  }

  function ensureSheet() {
    if (document.getElementById(SHEET_ID)) return;
    const root = document.createElement('div');
    root.id = SHEET_ID;
    root.className = 'dir-sheet hidden';
    root.innerHTML = `
      <div class="dir-backdrop" data-dir-close></div>
      <div class="dir-panel">
        <div class="dir-grabber"></div>
        <div class="dir-header" id="dir-header"></div>
        <div class="dir-tabs" id="dir-tabs"></div>
        <div class="dir-body" id="dir-body"></div>
      </div>
    `;
    document.body.appendChild(root);
    root.querySelector('[data-dir-close]').addEventListener('click', close);
  }

  function renderHeader() {
    const header = document.getElementById('dir-header');
    const placeQuery = encodeURIComponent(currentDest.name || `${currentDest.lat},${currentDest.lng}`);
    header.innerHTML = `
      <div class="dir-from">📍 현재 위치에서</div>
      <div class="dir-to">
        <strong>${esc(currentDest.name || '목적지')}</strong>
        <a href="https://www.google.com/maps/search/?api=1&query=${placeQuery}"
           target="_blank" class="dir-open-gmap">↗️ Google 지도</a>
      </div>
      <button class="dir-close-btn" data-dir-close>✕</button>
    `;
    header.querySelector('[data-dir-close]').addEventListener('click', close);
  }

  function renderTabs() {
    const tabs = document.getElementById('dir-tabs');
    const modes = [
      { id: 'WALKING',  icon: '🚶', label: '도보' },
      { id: 'TRANSIT',  icon: '🚇', label: '대중교통' },
      { id: 'DRIVING',  icon: '🚗', label: '자동차' },
      { id: 'TAXI',     icon: '🚕', label: '택시' },
    ];
    tabs.innerHTML = modes.map((m) => `
      <button class="dir-tab ${m.id === currentMode ? 'active' : ''}" data-mode="${m.id}">
        <span class="dir-tab-icon">${m.icon}</span>
        <span class="dir-tab-label">${m.label}</span>
      </button>
    `).join('');
    tabs.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.mode;
        renderTabs();
        fetchAndRender(currentMode);
      });
    });
  }

  function fetchAndRender(mode) {
    const body = document.getElementById('dir-body');
    body.innerHTML = `<div class="dir-loading">경로 계산 중...</div>`;

    if (cache[mode]) {
      renderResult(cache[mode], mode);
      return;
    }

    if (!isMapsConfigured()) {
      body.innerHTML = renderNoMapsMessage(mode);
      return;
    }

    if (typeof google === 'undefined' || !google.maps) {
      body.innerHTML = renderNoMapsMessage(mode);
      return;
    }

    const origin = MapView.getLastPosition();
    if (!origin) {
      body.innerHTML = `
        <div class="dir-empty">
          <p>📍 현재 위치를 확인할 수 없습니다.</p>
          <p class="dir-hint">위치 권한을 허용했는지 확인하세요. 권한 없이도 Google 지도 앱에서 직접 길찾기를 열 수 있습니다.</p>
          ${renderExternalLinks(mode)}
        </div>
      `;
      return;
    }

    // Taxi mode: use DRIVING and add a fare estimate + ride-hail deep link.
    const apiMode = mode === 'TAXI' ? 'DRIVING' : mode;

    const svc = new google.maps.DirectionsService();
    const request = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: currentDest.lat, lng: currentDest.lng },
      travelMode: google.maps.TravelMode[apiMode],
    };
    if (apiMode === 'TRANSIT') {
      request.transitOptions = { departureTime: new Date() };
    } else if (apiMode === 'DRIVING') {
      request.drivingOptions = {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      };
    }

    svc.route(request, (result, status) => {
      if (status !== 'OK') {
        cache[mode] = { error: status, origin, mode };
        body.innerHTML = renderError(status, mode, origin);
        return;
      }
      const parsed = parseRoute(result, mode, origin);
      cache[mode] = parsed;
      renderResult(parsed, mode);
    });
  }

  function parseRoute(result, mode, origin) {
    const route = result.routes[0];
    const leg = route.legs[0];
    return {
      mode,
      origin,
      duration: leg.duration ? leg.duration.text : null,
      durationInTraffic: leg.duration_in_traffic ? leg.duration_in_traffic.text : null,
      distance: leg.distance ? leg.distance.text : null,
      distanceMeters: leg.distance ? leg.distance.value : 0,
      departure: leg.departure_time ? leg.departure_time.text : null,
      arrival: leg.arrival_time ? leg.arrival_time.text : null,
      steps: leg.steps || [],
      fare: route.fare || null,   // Transit only — currency / value / text
    };
  }

  function renderResult(parsed, mode) {
    const body = document.getElementById('dir-body');
    if (parsed.error) {
      body.innerHTML = renderError(parsed.error, mode, parsed.origin);
      return;
    }

    const summary = renderSummary(parsed, mode);
    const steps = renderSteps(parsed, mode);
    const links = renderExternalLinks(mode, parsed);

    body.innerHTML = `${summary}${steps}${links}`;
  }

  function renderSummary(parsed, mode) {
    const dur = parsed.durationInTraffic
      ? `<strong>${esc(parsed.durationInTraffic)}</strong> <small>(평소 ${esc(parsed.duration)})</small>`
      : `<strong>${esc(parsed.duration || '–')}</strong>`;

    let fareLine = '';
    if (mode === 'TRANSIT' && parsed.fare) {
      fareLine = `<div class="dir-fare">💶 요금 ${esc(parsed.fare.text)}</div>`;
    } else if (mode === 'TAXI') {
      const est = estimateTaxiFare(parsed.distanceMeters);
      fareLine = `<div class="dir-fare">💶 택시 예상 ${est} <small>(국가별 기본요금 추정)</small></div>`;
    } else if (mode === 'DRIVING') {
      fareLine = `<div class="dir-fare-hint">⛽ 연료/통행료 별도</div>`;
    }

    let timeLine = '';
    if (mode === 'TRANSIT' && parsed.departure) {
      timeLine = `<div class="dir-time">🕒 ${esc(parsed.departure)} 출발 → ${esc(parsed.arrival)} 도착</div>`;
    }

    return `
      <div class="dir-summary">
        <div class="dir-summary-row">
          <span class="dir-summary-icon">${modeIcon(mode)}</span>
          <div class="dir-summary-stats">
            <div class="dir-duration">${dur}</div>
            <div class="dir-distance">${esc(parsed.distance || '')}</div>
          </div>
        </div>
        ${timeLine}
        ${fareLine}
      </div>
    `;
  }

  function renderSteps(parsed, mode) {
    if (!parsed.steps.length) return '';
    if (mode === 'TRANSIT') return renderTransitSteps(parsed.steps);
    if (mode === 'WALKING' || mode === 'DRIVING' || mode === 'TAXI') {
      return renderTurnByTurn(parsed.steps, mode);
    }
    return '';
  }

  function renderTransitSteps(steps) {
    const items = steps.map((s) => {
      if (s.travel_mode === 'WALKING') {
        return `
          <li class="dir-step walk">
            <span class="dir-step-icon">🚶</span>
            <div class="dir-step-body">
              <div>${esc(stripHtml(s.instructions))}</div>
              <small>${esc(s.distance ? s.distance.text : '')} · ${esc(s.duration ? s.duration.text : '')}</small>
            </div>
          </li>
        `;
      }
      const t = s.transit;
      if (!t) return '';
      const lineName = t.line.short_name || t.line.name;
      const vehicleIcon = transitIcon(t.line.vehicle && t.line.vehicle.type);
      const color = t.line.color || '#94a3b8';
      return `
        <li class="dir-step transit">
          <span class="dir-line-badge" style="background:${esc(color)}">
            ${vehicleIcon} ${esc(lineName || '')}
          </span>
          <div class="dir-step-body">
            <div><strong>${esc(t.departure_stop.name)}</strong> → <strong>${esc(t.arrival_stop.name)}</strong></div>
            <small>
              ${esc(t.departure_time ? t.departure_time.text : '')} 출발
              · ${t.num_stops}개 정거장
              · ${esc(s.duration ? s.duration.text : '')}
            </small>
            ${t.headsign ? `<small>방면: ${esc(t.headsign)}</small>` : ''}
          </div>
        </li>
      `;
    }).join('');
    return `<ol class="dir-steps">${items}</ol>`;
  }

  function renderTurnByTurn(steps, mode) {
    const trimmed = steps.slice(0, 12);
    const items = trimmed.map((s) => `
      <li class="dir-step">
        <span class="dir-step-icon">${mode === 'WALKING' ? '🚶' : '🚗'}</span>
        <div class="dir-step-body">
          <div>${esc(stripHtml(s.instructions))}</div>
          <small>${esc(s.distance ? s.distance.text : '')} · ${esc(s.duration ? s.duration.text : '')}</small>
        </div>
      </li>
    `).join('');
    const more = steps.length > trimmed.length
      ? `<li class="dir-step-more">… +${steps.length - trimmed.length}개 더</li>`
      : '';
    return `<ol class="dir-steps">${items}${more}</ol>`;
  }

  function renderExternalLinks(mode, parsed) {
    const dest = currentDest;
    const placeQuery = encodeURIComponent(dest.name || `${dest.lat},${dest.lng}`);
    const destCoords = `${dest.lat},${dest.lng}`;
    const travelMode = mode === 'TAXI' ? 'driving'
      : mode === 'TRANSIT' ? 'transit'
      : mode.toLowerCase();

    const gmap = `https://www.google.com/maps/dir/?api=1&destination=${placeQuery}&travelmode=${travelMode}`;
    const links = [];
    links.push(`<a class="dir-link primary" href="${gmap}" target="_blank">↗️ Google 지도에서 길찾기</a>`);

    if (mode === 'TAXI') {
      // Universal taxi/ride-hail deep links — apps detect destination coords.
      links.push(`<a class="dir-link" href="https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lng}&dropoff[nickname]=${placeQuery}" target="_blank">🚖 Uber 호출</a>`);
      links.push(`<a class="dir-link" href="https://bolt.eu/" target="_blank">🚕 Bolt 앱 열기</a>`);
      links.push(`<a class="dir-link" href="https://freenow.com/" target="_blank">🚕 FreeNow (유럽 택시)</a>`);
    }
    if (mode === 'TRANSIT') {
      links.push(`<a class="dir-link" href="https://citymapper.com/directions?endcoord=${destCoords}&endname=${placeQuery}" target="_blank">🚇 Citymapper</a>`);
    }
    return `<div class="dir-links">${links.join('')}</div>`;
  }

  function renderError(status, mode, origin) {
    const msg = ({
      ZERO_RESULTS: '경로를 찾을 수 없습니다. 다른 이동수단을 시도해보세요.',
      OVER_QUERY_LIMIT: 'Google API 일일 한도 초과. 잠시 후 다시 시도하세요.',
      REQUEST_DENIED: 'Directions API 가 활성화되지 않았습니다. Google Cloud Console 에서 활성화 필요.',
      INVALID_REQUEST: '잘못된 요청입니다.',
      NOT_FOUND: '출발지 또는 목적지를 찾을 수 없습니다.',
    }[status]) || `경로 조회 실패: ${status}`;
    return `
      <div class="dir-empty">
        <p>⚠️ ${esc(msg)}</p>
        ${renderExternalLinks(mode)}
      </div>
    `;
  }

  function renderNoMapsMessage(mode) {
    return `
      <div class="dir-empty">
        <p>🗺️ Google Maps API 키가 설정되지 않아 앱 안에서 경로 미리보기는 못 합니다.</p>
        <p class="dir-hint">대신 Google 지도 앱에서 바로 길찾기를 열 수 있습니다.</p>
        ${renderExternalLinks(mode)}
      </div>
    `;
  }

  // Rough taxi fare estimate by region. Used only when the user picked TAXI
  // and Google didn't return a fare (driving mode never does). Base + per-km.
  function estimateTaxiFare(meters) {
    if (!meters) return '–';
    const km = meters / 1000;
    // Pick the most likely region from the city of the current trip day,
    // falling back to "EU 평균".
    const day = TRIP.days[App.getCurrentDayIndex ? App.getCurrentDayIndex() : 0];
    const city = (day && day.city) ? day.city.toLowerCase() : '';

    const tariffs = [
      { match: /barcelona|madrid|spain|valencia|seville/, base: 2.30, perKm: 1.20, currency: '€', name: '스페인' },
      { match: /rome|naples|palermo|italy|milan|florence/, base: 3.00, perKm: 1.40, currency: '€', name: '이탈리아' },
      { match: /marseille|paris|france|nice|lyon/, base: 2.60, perKm: 1.80, currency: '€', name: '프랑스' },
      { match: /tunis|tunisia|sousse/, base: 0.50, perKm: 0.80, currency: 'TND', name: '튀니지' },
    ];
    const t = tariffs.find((x) => x.match.test(city)) || { base: 2.50, perKm: 1.50, currency: '€', name: 'EU 평균' };

    const total = t.base + t.perKm * km;
    return `${t.currency}${total.toFixed(1)} <small>(${t.name})</small>`;
  }

  function modeIcon(mode) {
    return ({ WALKING: '🚶', TRANSIT: '🚇', DRIVING: '🚗', TAXI: '🚕' }[mode]) || '📍';
  }

  function transitIcon(type) {
    return ({
      BUS: '🚌', SUBWAY: '🚇', TRAIN: '🚆', TRAM: '🚊',
      HEAVY_RAIL: '🚆', COMMUTER_TRAIN: '🚆', HIGH_SPEED_TRAIN: '🚄',
      FERRY: '⛴️', CABLE_CAR: '🚠', FUNICULAR: '🚞', GONDOLA_LIFT: '🚡',
    }[type]) || '🚌';
  }

  function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { open, close };
})();
