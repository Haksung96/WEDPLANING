// Google Maps integration with geolocation + proximity detection.

const MapView = (() => {
  let map = null;
  let userMarker = null;
  let eventMarkers = [];
  let watchId = null;
  let lastPosition = null;
  let mapsLoaded = false;
  let currentDayIndex = 0;
  let proximityNotified = new Set();

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

    renderMarkersForDay();
  }

  function renderMarkersForDay() {
    if (!map) return;

    eventMarkers.forEach((m) => m.setMap(null));
    eventMarkers = [];

    const day = TRIP.days[currentDayIndex];
    if (!day) return;

    // Center map on city
    if (day.cityCenter) {
      map.setCenter(day.cityCenter);
      map.setZoom(13);
    }

    const bounds = new google.maps.LatLngBounds();

    day.events.forEach((evt, i) => {
      if (!evt.location) return;
      const pos = { lat: evt.location.lat, lng: evt.location.lng };
      const marker = new google.maps.Marker({
        position: pos,
        map,
        label: { text: String(i + 1), color: 'white', fontWeight: 'bold', fontSize: '12px' },
        title: `${evt.time} ${evt.title}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: tagColor(evt.tag),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      const info = new google.maps.InfoWindow({
        content: `
          <div style="padding:6px; min-width:180px;">
            <strong>${escape(evt.time)} · ${escape(evt.title)}</strong><br/>
            <small>${escape(evt.location.name)}</small>
            ${evt.desc ? `<p style="margin-top:6px; font-size: 12px;">${escape(evt.desc)}</p>` : ''}
          </div>
        `,
      });
      marker.addListener('click', () => info.open(map, marker));
      eventMarkers.push(marker);
      bounds.extend(pos);
    });

    if (lastPosition) bounds.extend(lastPosition);
    if (!bounds.isEmpty()) map.fitBounds(bounds, 80);
  }

  function startLocationWatch() {
    if (!navigator.geolocation) {
      setStatus('이 브라우저는 위치 정보를 지원하지 않습니다.');
      return;
    }

    setStatus('위치 권한 요청 중...');

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (map) updateUserMarker();
        checkProximity();
        setStatus(`📍 현재 위치 추적 중 (정확도 ${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        const msg = err.code === 1 ? '위치 권한이 거부되었습니다.' : '위치를 가져올 수 없습니다.';
        setStatus(`⚠️ ${msg}`);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
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

  return { init, setDayIndex, dismissBanner };
})();
