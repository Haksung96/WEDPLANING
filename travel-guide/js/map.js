// Google Maps integration with geolocation + proximity detection + route drawing.

const MapView = (() => {
  let map = null;
  let userMarker = null;
  let partnerMarker = null;
  let partnerInfoWindow = null;
  let eventMarkers = [];
  let routeRenderers = [];     // DirectionsRenderer instances (one per leg)
  let routePolylines = [];     // Fallback straight-line polylines (one per leg)
  let watchId = null;
  let lastPosition = null;
  let mapsLoaded = false;
  let currentDayIndex = 0;
  let proximityNotified = new Set();
  let directionsService = null;
  let presenceStarted = false;
  let progressMap = {};        // shared from App so completed legs can be hidden

  // Per-leg color palette — distinct enough for adjacent segments to be
  // visually separable. Cycles if there are more legs than colors.
  const LEG_COLORS = [
    '#ff6b9d', '#60a5fa', '#fbbf24', '#4ade80',
    '#c084fc', '#fb7185', '#06b6d4', '#f59e0b',
    '#a78bfa', '#34d399', '#f43f5e', '#3b82f6',
  ];

  function setProgress(p) {
    progressMap = p || {};
    // Re-draw routes only if map is alive and currently rendering a day
    if (mapsLoaded) renderMarkersForDay();
  }

  function isDone(evt) {
    if (!evt || !evt._key) return false;
    return !!(progressMap[evt._key] && progressMap[evt._key].done);
  }

  function init() {
    if (!isMapsConfigured()) {
      const root = document.getElementById('map');
      if (root) {
        root.innerHTML = `
          <div style="text-align:center; padding:24px; max-width: 320px;">
            <p style="margin-bottom: 12px;">🗺️ 지도를 사용하려면<br/>Google Maps API 키가 필요합니다.</p>
            <p style="font-size: 12px; opacity: 0.7;">
              <code>js/config.js</code> 파일에서<br/>
              <code>GOOGLE_MAPS_API_KEY</code> 를 설정하세요.<br/>
              자세한 방법은 README 참고.
            </p>
          </div>
        `;
      }
      // Still try to track location for proximity events even without Maps
      startLocationWatch();
      return;
    }

    loadGoogleMaps()
      .then(() => {
        mapsLoaded = true;
        renderMap();
        startLocationWatch();
      })
      .catch((err) => {
        console.warn('Google Maps load failed:', err);
        document.getElementById('map').innerHTML = `<p>지도 로딩 실패. 인터넷 연결 확인.</p>`;
      });
  }

  function loadGoogleMaps() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) return resolve();
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=places&language=ko`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function setDayIndex(idx) {
    currentDayIndex = idx;
    if (mapsLoaded) renderMarkersForDay();
  }

  function renderMap() {
    const root = document.getElementById('map');
    root.innerHTML = ''; // clear placeholder

    map = new google.maps.Map(root, {
      center: { lat: 41.3851, lng: 2.1734 },  // Barcelona default
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      styles: getDarkMapStyle(),
    });

    directionsService = new google.maps.DirectionsService();
    renderMarkersForDay();
  }

  function clearRoute() {
    routeRenderers.forEach((r) => r.setMap(null));
    routeRenderers = [];
    routePolylines.forEach((p) => p.setMap(null));
    routePolylines = [];
  }

  // Draw each consecutive pair (leg) as its own polyline with a distinct color.
  // Skip legs whose BOTH endpoints are marked done — that's the "1+2 완료 → 1→2 사라짐" UX.
  function drawRoute(events) {
    clearRoute();
    if (!map || events.length < 2) return;

    for (let i = 0; i < events.length - 1; i++) {
      const a = events[i];
      const b = events[i + 1];
      if (isDone(a) && isDone(b)) continue;
      drawLeg(a, b, LEG_COLORS[i % LEG_COLORS.length]);
    }
  }

  function drawLeg(eventA, eventB, color) {
    const origin = { lat: eventA.location.lat, lng: eventA.location.lng };
    const destination = { lat: eventB.location.lat, lng: eventB.location.lng };

    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        if (status === 'OK') {
          renderLegRenderer(result, color);
          return;
        }
        // For impossible walking legs (e.g. across the sea between port stops),
        // fall back to driving, then to a dashed straight line.
        if (status === 'ZERO_RESULTS') {
          directionsService.route(
            { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
            (r2, s2) => {
              if (s2 === 'OK') renderLegRenderer(r2, color);
              else drawStraightLeg(origin, destination, color);
            }
          );
          return;
        }
        drawStraightLeg(origin, destination, color);
      }
    );
  }

  function renderLegRenderer(result, color) {
    const renderer = new google.maps.DirectionsRenderer({
      map,
      directions: result,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: color,
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });
    routeRenderers.push(renderer);
  }

  function drawStraightLeg(origin, destination, color) {
    const line = new google.maps.Polyline({
      path: [origin, destination],
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0,
      strokeWeight: 0,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3, strokeColor: color },
        offset: '0',
        repeat: '12px',
      }],
      map,
    });
    routePolylines.push(line);
  }

  function renderMarkersForDay() {
    if (!map) return;

    eventMarkers.forEach((m) => m.setMap(null));
    eventMarkers = [];
    clearRoute();

    const day = TRIP.days[currentDayIndex];
    if (!day) return;

    // Center map on city
    if (day.cityCenter) {
      map.setCenter(day.cityCenter);
      map.setZoom(13);
    }

    // Apply user-edited overrides so the map reflects edits made in Today view
    const events = typeof EventEditor !== 'undefined'
      ? EventEditor.applyOverrides(day, day.events)
      : day.events;

    const bounds = new google.maps.LatLngBounds();
    // Iterate over the FULL events array so the marker number stays equal
    // to the card's number in the Today view (i.e. event.indexInDay + 1),
    // even when some events have no location (those are simply skipped).
    const routePoints = [];

    events.forEach((evt, i) => {
      if (!evt.location) return;
      const number = i + 1;
      const pos = { lat: evt.location.lat, lng: evt.location.lng };
      routePoints.push(evt);

      const done = isDone(evt);
      const markerSvg = createNumberedMarker(number, tagColor(evt.tag), done);

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: `${number}. ${evt.time} ${evt.title}${done ? ' ✓' : ''}`,
        icon: {
          url: markerSvg,
          scaledSize: new google.maps.Size(36, 44),
          anchor: new google.maps.Point(18, 44),
        },
        opacity: done ? 0.55 : 1,
        zIndex: 100 + i,
      });

      const cityHint = day.city ? ' ' + day.city : '';
      const placeQuery = encodeURIComponent(`${evt.location.name}${cityHint}`);
      const locJson = JSON.stringify(evt.location).replace(/'/g, "&#39;").replace(/"/g, '&quot;');
      const info = new google.maps.InfoWindow({
        content: `
          <div style="padding:6px; min-width:200px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span style="background:${tagColor(evt.tag)}; color:white; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">${number}</span>
              <strong>${escape(evt.time)} · ${escape(evt.title)}</strong>
            </div>
            <div style="font-size: 12px; color:#666;">📍 ${escape(evt.location.name)}</div>
            ${evt.desc ? `<p style="margin-top:6px; font-size: 12px; line-height:1.4;">${escape(evt.desc)}</p>` : ''}
            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
              <button data-iw-route='${locJson}'
                      style="background:#ff6b9d; color:white; border:none; border-radius:14px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer;">
                🚦 경로
              </button>
              <a href="https://www.google.com/maps/search/?api=1&query=${placeQuery}"
                 target="_blank"
                 style="display:inline-block; font-size:12px; color:#ff6b9d; font-weight:700; align-self:center;">
                ↗️ Google 지도
              </a>
            </div>
          </div>
        `,
      });
      marker.addListener('click', () => {
        info.open(map, marker);
        // Wire the route button after the InfoWindow renders
        google.maps.event.addListenerOnce(info, 'domready', () => {
          const btn = document.querySelector('[data-iw-route]');
          if (!btn) return;
          btn.addEventListener('click', () => {
            try {
              const loc = JSON.parse(btn.dataset.iwRoute.replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
              if (typeof Directions !== 'undefined') Directions.open(loc);
            } catch (err) { console.warn(err); }
          });
        });
      });
      eventMarkers.push(marker);
      bounds.extend(pos);
    });

    // Draw route connecting events in time order (skipping numberless gaps)
    if (routePoints.length >= 2) {
      drawRoute(routePoints);
    }

    if (lastPosition) bounds.extend(lastPosition);
    if (!bounds.isEmpty()) map.fitBounds(bounds, 80);
  }

  // Create a numbered pin marker as inline SVG data URI.
  // `done=true` renders a check mark over the number.
  function createNumberedMarker(number, color, done) {
    const numberOrCheck = done
      ? `<text x="18" y="24" text-anchor="middle" font-family="-apple-system,Segoe UI,sans-serif"
               font-size="16" font-weight="900" fill="${color}">✓</text>`
      : `<text x="18" y="23" text-anchor="middle" font-family="-apple-system,Segoe UI,sans-serif"
               font-size="14" font-weight="800" fill="${color}">${number}</text>`;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
        <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"
              fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="18" cy="18" r="11" fill="white"/>
        ${numberOrCheck}
      </svg>
    `.trim();
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function startLocationWatch() {
    if (!navigator.geolocation) {
      setStatus('이 브라우저는 위치 정보를 지원하지 않습니다.');
      return;
    }

    setStatus('위치 권한 요청 중...');

    // Even before our first GPS fix, listen for the partner so the badge
    // updates when they appear (we'll just lack a "distance" value).
    if (!presenceStarted && typeof Presence !== 'undefined') {
      presenceStarted = true;
      Presence.start(
        () => lastPosition,
        (partner) => updatePartnerMarker(partner)
      );
    }

    // Battery saver mode: when ON (default OFF), use lower-accuracy GPS
    // and a longer cache window. Saves significant battery on multi-day
    // trips at the cost of ~50m position drift.
    const saver = (function() {
      try {
        const raw = localStorage.getItem('wedplan:settings');
        return raw && JSON.parse(raw).batterySaver;
      } catch { return false; }
    })();
    const watchOpts = saver
      ? { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 }
      : { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        if (map) updateUserMarker();
        checkProximity();
        const acc = Math.round(pos.coords.accuracy);
        setStatus(`📍 현재 위치 추적 중 (정확도 ${acc}m${saver ? ' · 배터리 절약' : ''})`);
      },
      (err) => {
        const msg = err.code === 1
          ? '위치 권한이 거부되었습니다. 설정 → 사이트 권한에서 허용 필요.'
          : '위치를 가져올 수 없습니다.';
        setStatus(`⚠️ ${msg}`);
      },
      watchOpts
    );
  }

  function setPartnerStatus(html, kind) {
    const el = document.getElementById('partner-status');
    if (!el) return;
    el.innerHTML = html;
    el.className = 'partner-status ' + (kind || '');
  }

  function updatePartnerMarker(partner) {
    if (!partner || partner.lat == null || partner.lng == null) {
      // No partner yet — show a friendly hint so the user knows what to do
      const me = (typeof Sync !== 'undefined') ? Sync.getUser().name : '나';
      const other = me === '남편' ? '와이프' : '남편';
      const mode = (typeof Sync !== 'undefined' && Sync.getMode) ? Sync.getMode() : 'local';
      if (mode !== 'firebase') {
        setPartnerStatus('💑 로컬 모드 — 위치 공유는 Firebase 설정 후 가능', 'warn');
      } else {
        setPartnerStatus(`💑 ${other} 위치 대기 중... (둘 다 로그인하고 위치 권한 허용 필요)`, 'wait');
      }
      if (partnerMarker) {
        partnerMarker.setMap(null);
        partnerMarker = null;
      }
      return;
    }
    if (!map) {
      // Map not ready but presence arrived — at least update the status badge
      const ageStr = Presence.formatAge(partner._updatedAt);
      setPartnerStatus(`💑 ${escape(partner.name)} · ${escape(ageStr)}`, Presence.isStale(partner) ? 'stale' : 'live');
      return;
    }

    const pos = { lat: partner.lat, lng: partner.lng };
    const stale = Presence.isStale(partner);
    const ageStr = Presence.formatAge(partner._updatedAt);
    const dist = lastPosition ? haversine(lastPosition, pos) : null;
    const distStr = dist == null ? '' : (dist < 1000 ? `${Math.round(dist)}m` : `${(dist/1000).toFixed(1)}km`);

    const partnerSvg = createPartnerMarker(partner.name || '👤', stale);
    const title = `${partner.name} · ${ageStr}${distStr ? ' · ' + distStr : ''}`;

    if (partnerMarker) {
      partnerMarker.setPosition(pos);
      partnerMarker.setIcon({
        url: partnerSvg,
        scaledSize: new google.maps.Size(40, 48),
        anchor: new google.maps.Point(20, 48),
      });
      partnerMarker.setTitle(title);
    } else {
      partnerMarker = new google.maps.Marker({
        position: pos,
        map,
        title,
        icon: {
          url: partnerSvg,
          scaledSize: new google.maps.Size(40, 48),
          anchor: new google.maps.Point(20, 48),
        },
        zIndex: 9000,
      });

      partnerInfoWindow = new google.maps.InfoWindow();
      partnerMarker.addListener('click', () => {
        const ageNow = Presence.formatAge(partner._updatedAt);
        const distNow = lastPosition ? haversine(lastPosition, pos) : null;
        const distNowStr = distNow == null ? '' : (distNow < 1000 ? `${Math.round(distNow)}m` : `${(distNow/1000).toFixed(1)}km`);
        partnerInfoWindow.setContent(`
          <div style="padding:8px; min-width:180px;">
            <strong>📍 ${escape(partner.name)}</strong><br/>
            <small>마지막 업데이트: ${escape(ageNow)}</small><br/>
            ${distNowStr ? `<small>나와의 거리: <strong>${escape(distNowStr)}</strong></small><br/>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${pos.lat},${pos.lng}&travelmode=walking"
               target="_blank"
               style="display:inline-block; margin-top:6px; font-size:12px; color:#ff6b9d; font-weight:700;">
              ↗️ 만나러 가기
            </a>
          </div>
        `);
        partnerInfoWindow.open(map, partnerMarker);
      });
    }

    // Update the dedicated partner-status badge
    setPartnerStatus(
      `💑 <strong>${escape(partner.name)}</strong> · ${escape(ageStr)}${distStr ? ' · ' + escape(distStr) + ' 거리' : ''}${stale ? ' · <em>오래됨</em>' : ''}`,
      stale ? 'stale' : 'live'
    );
  }

  function createPartnerMarker(name, stale) {
    const color = stale ? '#94a3b8' : '#a78bfa';
    const ring = stale ? '#64748b' : '#7c3aed';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
        <circle cx="20" cy="20" r="18" fill="${color}" opacity="0.25"/>
        <circle cx="20" cy="20" r="14" fill="${color}" stroke="white" stroke-width="3"/>
        <text x="20" y="25" text-anchor="middle" font-family="-apple-system,Segoe UI,sans-serif"
              font-size="14" font-weight="800" fill="white">💕</text>
        <path d="M14 36 L20 46 L26 36 Z" fill="${ring}" stroke="white" stroke-width="1.5"/>
      </svg>
    `.trim();
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function updateUserMarker() {
    if (!lastPosition || !map) return;
    if (userMarker) {
      userMarker.setPosition(lastPosition);
    } else {
      userMarker = new google.maps.Marker({
        position: lastPosition,
        map,
        title: '현재 위치',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 9999,
      });
    }
  }

  function checkProximity() {
    if (!lastPosition) return;

    const day = TRIP.days[currentDayIndex];
    if (!day) return;

    day.events.forEach((evt, i) => {
      if (!evt.location) return;
      const dist = haversine(lastPosition, evt.location);
      const radius = evt.radius || CONFIG.PROXIMITY_RADIUS_METERS;
      const key = `${day.date}-${i}`;
      if (dist <= radius && !proximityNotified.has(key)) {
        proximityNotified.add(key);
        showProximityBanner(evt, Math.round(dist));
        notifyDevice(evt);
      }
    });
  }

  function showProximityBanner(evt, distance) {
    const banner = document.getElementById('proximity-banner');
    const title = document.getElementById('proximity-title');
    const desc = document.getElementById('proximity-desc');
    if (!banner) return;
    title.textContent = `${evt.location.name} 근처 (${distance}m)`;
    desc.textContent = `${evt.time} · ${evt.title}${evt.desc ? ' — ' + evt.desc : ''}`;
    banner.classList.remove('hidden');
  }

  function notifyDevice(evt) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(`📍 ${evt.location.name} 도착`, {
        body: `${evt.time} · ${evt.title}`,
        icon: 'icons/icon-192.png',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  function setStatus(text) {
    const el = document.getElementById('map-status');
    if (el) el.textContent = text;
  }

  function dismissBanner() {
    document.getElementById('proximity-banner').classList.add('hidden');
  }

  // Haversine distance in meters
  function haversine(a, b) {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sa = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(sa));
  }
  function toRad(d) { return d * Math.PI / 180; }

  function tagColor(tag) {
    return ({
      food: '#fb7185', walk: '#60a5fa', shop: '#c084fc',
      attraction: '#fbbf24', hotel: '#4ade80', cruise: '#06b6d4',
      transport: '#94a3b8', flight: '#f43f5e', rest: '#a78bfa',
    }[tag] || '#ff6b9d');
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function getDarkMapStyle() {
    if (!window.matchMedia || !window.matchMedia('(prefers-color-scheme: dark)').matches) return null;
    return [
      { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#a0a0b8' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#0f0f1a' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0a1a' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252540' }] },
      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f1f33' }] },
    ];
  }

  function getLastPosition() {
    return lastPosition ? { lat: lastPosition.lat, lng: lastPosition.lng } : null;
  }

  return { init, setDayIndex, dismissBanner, getLastPosition, setProgress };
})();
