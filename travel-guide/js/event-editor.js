// Event editor sheet — edit time and location of an itinerary event.
// Location is searched via Google Places Autocomplete (text predictions)
// + place details fetch. Edits are saved as overrides in Sync, so they
// flow to the partner phone in real-time.
//
// This module also owns the supporting persistence layers:
//   - event_overrides   (per event field overrides)
//   - event_inserts     (new events added to a day)
//   - event_deletes     (events removed from a day)
//   - day_date_swaps    (date assigned to each day; supports day swap)

const EventEditor = (() => {
  const SHEET_ID = 'editor-sheet';
  const COLLECTION = 'event_overrides';
  const INSERTS = 'event_inserts';
  const DELETES = 'event_deletes';
  const DAY_SWAPS = 'day_date_swaps';

  let overrides = {};
  let inserts = {};
  let deletes = {};
  let daySwaps = {};
  let onChange = null;
  let currentKey = null;
  let currentEvent = null;
  let currentDay = null;
  let originalEvent = null;
  let placesService = null;
  let predictionsCache = [];

  function init(notify) {
    onChange = notify;
    const fire = () => { if (onChange) onChange(); };
    Sync.subscribe(COLLECTION, (items) => { overrides = items || {}; fire(); });
    Sync.subscribe(INSERTS, (items) => { inserts = items || {}; fire(); });
    Sync.subscribe(DELETES, (items) => { deletes = items || {}; fire(); });
    Sync.subscribe(DAY_SWAPS, (items) => { daySwaps = items || {}; fire(); });
  }

  function getOverrides() {
    return overrides;
  }

  // Effective date for a day index — checks day_date_swaps first.
  // The swap entry uses the original date as the key.
  function effectiveDate(originalDate) {
    const swap = daySwaps[originalDate];
    return (swap && swap.date) ? swap.date : originalDate;
  }

  function isDaySwapped(originalDate) {
    return !!(daySwaps[originalDate] && daySwaps[originalDate].date && daySwaps[originalDate].date !== originalDate);
  }

  // Apply overrides + inserts + deletes on top of TRIP.days[i].events.
  // Returns a NEW array; does not mutate TRIP. Result entries carry an
  // _index field used as the per-day key (so insert/delete keys remain
  // stable when the time changes the visual order).
  function applyOverrides(day, events) {
    if (!events) events = [];
    // Originals: index by position in TRIP source
    const result = events.map((evt, i) => {
      const key = `${day.date}-${i}`;
      if (deletes[key]) return null;
      const ov = overrides[key];
      const merged = { ...evt, _key: key, _origin: 'static' };
      if (ov) {
        if (ov.time != null) merged.time = ov.time;
        if (ov.title != null) merged.title = ov.title;
        if (ov.desc != null) merged.desc = ov.desc;
        if (ov.location !== undefined) merged.location = ov.location;
        if (ov.tag != null) merged.tag = ov.tag;
        merged._edited = true;
        merged._editedBy = ov._updatedBy;
      }
      return merged;
    }).filter(Boolean);

    // Inserts: keys like `${date}::${insertId}`
    Object.entries(inserts).forEach(([id, evt]) => {
      if (!id.startsWith(day.date + '::')) return;
      result.push({ ...evt, _key: id, _origin: 'insert', _editedBy: evt._updatedBy });
    });

    // Sort by time (HH:MM) so newly inserted events slot in chronologically;
    // items without a parseable time go last but keep their relative order.
    result.sort((a, b) => {
      const ta = parseTime(a.time);
      const tb = parseTime(b.time);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    });
    return result;
  }

  function parseTime(t) {
    if (!t) return null;
    const m = String(t).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  // ---- Day-swap API ----
  // Swap the dates of two days. Both swap entries are written symmetrically
  // so the operation is idempotent regardless of which side initiated it.
  async function swapDayDates(dateA, dateB) {
    if (dateA === dateB) return;
    // If A was already pointing somewhere, unwind that target first
    await Sync.setItem(DAY_SWAPS, dateA, { date: dateB });
    await Sync.setItem(DAY_SWAPS, dateB, { date: dateA });
  }

  async function clearDaySwap(date) {
    const swap = daySwaps[date];
    await Sync.deleteItem(DAY_SWAPS, date);
    // Also clear the symmetric pair if it points back to us
    if (swap && swap.date && daySwaps[swap.date] && daySwaps[swap.date].date === date) {
      await Sync.deleteItem(DAY_SWAPS, swap.date);
    }
  }

  // ---- Insert / delete API ----
  function deleteEvent(day, eventEntry) {
    if (!eventEntry || !eventEntry._key) return;
    if (eventEntry._origin === 'insert') {
      Sync.deleteItem(INSERTS, eventEntry._key);
    } else {
      Sync.setItem(DELETES, eventEntry._key, { deleted: true });
      // Also drop any override for that key to keep storage tidy
      Sync.deleteItem(COLLECTION, eventEntry._key);
    }
  }

  function restoreEvent(eventEntry) {
    if (!eventEntry || eventEntry._origin !== 'static') return;
    Sync.deleteItem(DELETES, eventEntry._key);
  }

  function openInsert(day) {
    currentDay = day;
    const id = `${day.date}::${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    currentKey = id;
    originalEvent = null;
    currentEvent = {
      time: '12:00',
      title: '',
      desc: '',
      location: null,
      tag: '',
      _origin: 'insert',
    };
    ensureSheet();
    document.getElementById(SHEET_ID).classList.remove('hidden');
    render(true);
    bindForm(true);
  }

  function open(day, eventEntry) {
    currentDay = day;
    originalEvent = eventEntry;

    if (eventEntry && eventEntry._origin === 'insert') {
      // Editing a previously-inserted event in-place
      currentKey = eventEntry._key;
      currentEvent = {
        time: eventEntry.time,
        title: eventEntry.title,
        desc: eventEntry.desc,
        location: eventEntry.location,
        tag: eventEntry.tag || '',
        _origin: 'insert',
      };
    } else {
      // Editing a static (data.js) event — key is its original date+index
      currentKey = eventEntry._key;
      const ov = overrides[currentKey] || {};
      currentEvent = {
        time: ov.time != null ? ov.time : eventEntry.time,
        title: ov.title != null ? ov.title : eventEntry.title,
        desc: ov.desc != null ? ov.desc : eventEntry.desc,
        location: ov.location !== undefined ? ov.location : eventEntry.location,
        tag: ov.tag != null ? ov.tag : (eventEntry.tag || ''),
        _origin: 'static',
      };
    }

    ensureSheet();
    document.getElementById(SHEET_ID).classList.remove('hidden');
    render(false);
    bindForm(false);
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

  function render(isInsertMode) {
    const isOverridden = !isInsertMode && !!overrides[currentKey];
    document.getElementById('edit-title').textContent = isInsertMode
      ? `${currentDay.date} 일정 추가`
      : `${currentDay.date} · ${currentEvent.time || '시간 미정'} 편집`;

    const body = document.getElementById('edit-body');
    const tags = ['food', 'walk', 'shop', 'attraction', 'hotel', 'cruise', 'transport', 'flight', 'rest'];
    const tagLabels = { food: '🍽️ 식사', walk: '🚶 산책', shop: '🛍️ 쇼핑', attraction: '🎡 명소', hotel: '🏨 숙소', cruise: '🛳️ 크루즈', transport: '🚌 이동', flight: '✈️ 항공', rest: '😴 휴식' };

    body.innerHTML = `
      <label class="edit-label">시간</label>
      <input id="edit-time" type="text" inputmode="numeric"
             placeholder="08:30" value="${esc(currentEvent.time || '')}" />
      <p class="edit-hint">HH:MM 형식. 예: 09:00 또는 14:30</p>

      <label class="edit-label">제목</label>
      <input id="edit-event-title" type="text" placeholder="일정 제목"
             value="${esc(currentEvent.title || '')}" />

      <label class="edit-label">분류</label>
      <div class="edit-tag-grid">
        ${tags.map((t) => `
          <button type="button" class="edit-tag ${currentEvent.tag === t ? 'active' : ''}" data-tag="${t}">
            ${tagLabels[t]}
          </button>
        `).join('')}
      </div>

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
          <button type="button" id="edit-clear-place" class="edit-mini-btn">제거</button>
        ` : '<em>장소 없음</em>'}
      </div>

      <label class="edit-label">장소 ${currentEvent.location ? '변경' : '추가'} (Google 검색)</label>
      <input id="edit-place-search" type="text"
             placeholder="장소 이름 또는 주소 (예: Catedral de Barcelona)"
             autocomplete="off" />
      <div id="edit-place-results" class="edit-place-results"></div>

      <div class="edit-actions">
        <button id="edit-save" class="btn-primary">${isInsertMode ? '추가' : '저장'}</button>
        ${isInsertMode
          ? ''
          : (isOverridden
              ? '<button id="edit-reset" class="btn-secondary">원본으로 되돌리기</button>'
              : '')}
        <button id="edit-cancel" class="btn-secondary">취소</button>
      </div>
      ${!isInsertMode && overrides[currentKey] && overrides[currentKey]._updatedBy
        ? `<p class="edit-meta">최근 편집: ${esc(overrides[currentKey]._updatedBy)} · ${formatTime(overrides[currentKey]._updatedAt)}</p>`
        : ''}
    `;
  }

  function bindForm(isInsertMode) {
    document.getElementById('edit-cancel').addEventListener('click', close);

    const resetBtn = document.getElementById('edit-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('이 일정을 원본 (data.js) 값으로 되돌리시겠습니까?')) return;
        Sync.deleteItem(COLLECTION, currentKey);
        close();
      });
    }

    document.getElementById('edit-save').addEventListener('click', () => save(isInsertMode));

    document.querySelectorAll('[data-tag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentEvent.tag = currentEvent.tag === btn.dataset.tag ? '' : btn.dataset.tag;
        document.querySelectorAll('[data-tag]').forEach((b) =>
          b.classList.toggle('active', b.dataset.tag === currentEvent.tag));
      });
    });

    const clearPlaceBtn = document.getElementById('edit-clear-place');
    if (clearPlaceBtn) {
      clearPlaceBtn.addEventListener('click', () => {
        currentEvent.location = null;
        render(isInsertMode);
        bindForm(isInsertMode);
      });
    }

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
        const isInsertMode = !!(originalEvent === null || (currentEvent && currentEvent._origin === 'insert'));
        document.getElementById('edit-place-search').value = '';
        render(isInsertMode);
        bindForm(isInsertMode);
      }
    );
  }

  function save(isInsertMode) {
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

    const payload = {
      time,
      title,
      desc,
      tag: currentEvent.tag || '',
      location: currentEvent.location || null,
    };
    if (isInsertMode || currentEvent._origin === 'insert') {
      Sync.setItem(INSERTS, currentKey, payload);
    } else {
      Sync.setItem(COLLECTION, currentKey, payload);
    }
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

  return {
    init, open, close, applyOverrides, getOverrides,
    effectiveDate, isDaySwapped, swapDayDates, clearDaySwap,
    deleteEvent, restoreEvent, openInsert,
  };
})();
