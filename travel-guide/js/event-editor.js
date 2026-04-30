// Event editor sheet — edit time and location of an itinerary event.
// Location is searched via Google Places Autocomplete (text predictions)
// + place details fetch. Edits are saved as overrides in Sync, so they
// flow to the partner phone in real-time.

const EventEditor = (() => {
  const SHEET_ID = 'editor-sheet';
  const COLLECTION = 'event_overrides';

  let overrides = {};
  let onChange = null;
  let currentKey = null;
  let currentEvent = null;
  let currentDay = null;
  let originalEvent = null;
  let placesService = null;
  let predictionsCache = [];

  function init(notify) {
    onChange = notify;
    Sync.subscribe(COLLECTION, (items) => {
      overrides = items || {};
      if (onChange) onChange(overrides);
    });
  }

  function getOverrides() {
    return overrides;
  }

  // Apply overrides on top of TRIP.days[i].events. Returns a NEW array
  // — does not mutate TRIP. The override schema is the same shape as
  // an event (time, title, desc, location, tag), but every field is
  // optional and only present fields override.
  function applyOverrides(day, events) {
    if (!events) return [];
    return events.map((evt, i) => {
      const key = `${day.date}-${i}`;
      const ov = overrides[key];
      if (!ov) return evt;
      const merged = { ...evt };
      if (ov.time != null) merged.time = ov.time;
      if (ov.title != null) merged.title = ov.title;
      if (ov.desc != null) merged.desc = ov.desc;
      if (ov.location != null) merged.location = ov.location;
      merged._edited = true;
      merged._editedBy = ov._updatedBy;
      return merged;
    });
  }

  function open(day, eventIndex, originalEvt) {
    currentDay = day;
    currentKey = `${day.date}-${eventIndex}`;
    originalEvent = originalEvt;
    // Start from the currently-rendered (overridden) event so the form
    // shows the latest values, not the data.js originals.
    const ov = overrides[currentKey] || {};
    currentEvent = {
      time: ov.time != null ? ov.time : originalEvt.time,
      title: ov.title != null ? ov.title : originalEvt.title,
      desc: ov.desc != null ? ov.desc : originalEvt.desc,
      location: ov.location != null ? ov.location : originalEvt.location,
    };

    ensureSheet();
    document.getElementById(SHEET_ID).classList.remove('hidden');
    render();
    bindForm();
  }

  function close() {
    const sheet = document.getElementById(SHEET_ID);
    if (sheet) sheet.classList.add('hidden');
    predictionsCache = [];
  }

  function ensureSheet() {
    if (document.getElementById(SHEET_ID)) return;
    const root = document.createElement('div');
    root.id = SHEET_ID;
    root.className = 'edit-sheet hidden';
    root.innerHTML = `
      <div class="edit-backdrop" data-edit-close></div>
      <div class="edit-panel">
        <div class="edit-grabber"></div>
        <div class="edit-header">
          <strong id="edit-title">일정 편집</strong>
          <button class="edit-close-btn" data-edit-close>✕</button>
        </div>
        <div class="edit-body" id="edit-body"></div>
      </div>
    `;
    document.body.appendChild(root);
    root.querySelectorAll('[data-edit-close]').forEach((el) =>
      el.addEventListener('click', close)
    );
  }

  function render() {
    const isOverridden = !!overrides[currentKey];
    document.getElementById('edit-title').textContent =
      `${currentDay.date} · ${currentEvent.time || '시간 미정'} 편집`;

    const body = document.getElementById('edit-body');
    body.innerHTML = `
      <label class="edit-label">시간</label>
      <input id="edit-time" type="text" inputmode="numeric"
             placeholder="08:30" value="${esc(currentEvent.time || '')}" />
      <p class="edit-hint">HH:MM 형식. 예: 09:00 또는 14:30</p>

      <label class="edit-label">제목</label>
      <input id="edit-event-title" type="text" placeholder="일정 제목"
             value="${esc(currentEvent.title || '')}" />

      <label class="edit-label">설명 (선택)</label>
      <textarea id="edit-desc" rows="2" placeholder="간단한 메모">${esc(currentEvent.desc || '')}</textarea>

      <label class="edit-label">장소</label>
      <div class="edit-current-place">
        ${currentEvent.location ? `
          <span class="edit-place-pin">📍</span>
          <div>
            <strong>${esc(currentEvent.location.name)}</strong>
            <small>${esc(currentEvent.location.lat.toFixed(5))}, ${esc(currentEvent.location.lng.toFixed(5))}</small>
          </div>
        ` : '<em>장소 없음</em>'}
      </div>

      <label class="edit-label">장소 변경 (Google 검색)</label>
      <input id="edit-place-search" type="text"
             placeholder="장소 이름 또는 주소 (예: Catedral de Barcelona)"
             autocomplete="off" />
      <div id="edit-place-results" class="edit-place-results"></div>

      <div class="edit-actions">
        <button id="edit-save" class="btn-primary">저장</button>
        ${isOverridden
          ? '<button id="edit-reset" class="btn-secondary">원본으로 되돌리기</button>'
          : ''}
        <button id="edit-cancel" class="btn-secondary">취소</button>
      </div>
      ${overrides[currentKey] && overrides[currentKey]._updatedBy
        ? `<p class="edit-meta">최근 편집: ${esc(overrides[currentKey]._updatedBy)} · ${formatTime(overrides[currentKey]._updatedAt)}</p>`
        : ''}
    `;
  }

  function bindForm() {
    document.getElementById('edit-cancel').addEventListener('click', close);

    const resetBtn = document.getElementById('edit-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('이 일정을 원본 (data.js) 값으로 되돌리시겠습니까?')) return;
        Sync.deleteItem(COLLECTION, currentKey);
        close();
      });
    }

    document.getElementById('edit-save').addEventListener('click', save);

    const searchInput = document.getElementById('edit-place-search');
    let debounce = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      const q = searchInput.value.trim();
      if (q.length < 2) {
        document.getElementById('edit-place-results').innerHTML = '';
        return;
      }
      debounce = setTimeout(() => searchPlaces(q), 300);
    });
  }

  function searchPlaces(query) {
    const results = document.getElementById('edit-place-results');
    if (!isMapsConfigured()) {
      results.innerHTML = `
        <div class="edit-place-empty">
          ⚠️ Google Maps API 키가 설정되지 않아 장소 검색을 사용할 수 없습니다.
          <br/>설정 → Google Maps API 키 입력 후 다시 시도하세요.
        </div>
      `;
      return;
    }
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      results.innerHTML = `<div class="edit-place-empty">지도 라이브러리 로딩 중... 잠시 후 다시 시도하세요.</div>`;
      return;
    }

    results.innerHTML = `<div class="edit-place-loading">검색 중...</div>`;

    const service = new google.maps.places.AutocompleteService();
    const cityBias = currentDay && currentDay.cityCenter
      ? { location: new google.maps.LatLng(currentDay.cityCenter.lat, currentDay.cityCenter.lng), radius: 30000 }
      : {};

    service.getPlacePredictions(
      { input: query, ...cityBias },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          results.innerHTML = `<div class="edit-place-empty">결과 없음 (${esc(status)})</div>`;
          return;
        }
        predictionsCache = predictions;
        renderPredictions(predictions);
      }
    );
  }

  function renderPredictions(predictions) {
    const results = document.getElementById('edit-place-results');
    results.innerHTML = predictions.slice(0, 6).map((p, i) => `
      <button class="edit-place-row" data-pred-idx="${i}">
        <span class="edit-place-pin">📍</span>
        <div class="edit-place-text">
          <strong>${esc(p.structured_formatting.main_text)}</strong>
          <small>${esc(p.structured_formatting.secondary_text || '')}</small>
        </div>
      </button>
    `).join('');
    results.querySelectorAll('[data-pred-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.predIdx);
        const pred = predictionsCache[idx];
        if (!pred) return;
        fetchPlaceDetails(pred);
      });
    });
  }

  function fetchPlaceDetails(prediction) {
    const results = document.getElementById('edit-place-results');
    results.innerHTML = `<div class="edit-place-loading">장소 정보 가져오는 중...</div>`;

    if (!placesService) {
      // PlacesService needs an HTML element or a Map; we use a hidden div.
      const dummy = document.createElement('div');
      placesService = new google.maps.places.PlacesService(dummy);
    }

    placesService.getDetails(
      { placeId: prediction.place_id, fields: ['name', 'geometry', 'formatted_address'] },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          results.innerHTML = `<div class="edit-place-empty">상세정보 조회 실패: ${esc(status)}</div>`;
          return;
        }
        currentEvent.location = {
          name: place.name || prediction.structured_formatting.main_text,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address || '',
        };
        // Re-render so the "current place" block updates and clear search
        document.getElementById('edit-place-search').value = '';
        render();
        bindForm();
      }
    );
  }

  function save() {
    const time = (document.getElementById('edit-time').value || '').trim();
    const title = (document.getElementById('edit-event-title').value || '').trim();
    const desc = (document.getElementById('edit-desc').value || '').trim();

    if (time && !/^\d{1,2}:\d{2}/.test(time)) {
      alert('시간 형식이 올바르지 않습니다. 예: 09:00');
      return;
    }
    if (!title) {
      alert('제목을 입력하세요.');
      return;
    }

    const payload = { time, title, desc, location: currentEvent.location || null };
    Sync.setItem(COLLECTION, currentKey, payload);
    close();
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

  return { init, open, close, applyOverrides, getOverrides };
})();
