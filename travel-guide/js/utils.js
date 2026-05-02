// Shared utilities — extracted from app.js, map.js, event-editor.js,
// directions.js, presence.js, expenses.js, checklist.js, vault.js,
// settings.js. Each used to define its own escape/haversine/parseTime/
// formatTime/tagColor copies; consolidating them here removes ~200 lines
// of duplicated code and ensures consistent behavior (e.g. timezone safe
// localDateStr, identical haversine constants).

const Utils = (() => {

  // -------- HTML escaping --------
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }

  // -------- Date / time --------

  // Local-date string in YYYY-MM-DD form. Critical for "today" detection:
  // `new Date().toISOString().slice(0, 10)` returns UTC date, which flips
  // a day at midnight Europe time / 09:00 Korea time → wrong "today".
  function localDateStr(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Parse "HH:MM" or "HH:MM ~ HH:MM" → minutes since midnight (first time wins).
  function parseTimeToMin(timeStr) {
    if (!timeStr) return null;
    const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  // Korean weekday for a YYYY-MM-DD string (TZ-safe via 12:00 noon anchor).
  const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
  function weekdayOf(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return WEEKDAYS_KO[d.getDay()];
  }

  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  // "n초 전" / "n분 전" / "n시간 m분 전". Returns '' for null timestamps.
  function formatAge(updatedAt) {
    if (!updatedAt) return '';
    const ageSec = Math.floor((Date.now() - updatedAt) / 1000);
    if (ageSec < 60) return `${ageSec}초 전`;
    const ageMin = Math.floor(ageSec / 60);
    if (ageMin < 60) return `${ageMin}분 전`;
    const ageHr = Math.floor(ageMin / 60);
    return `${ageHr}시간 ${ageMin % 60}분 전`;
  }

  function formatCountdown(mins) {
    if (mins < 0) return '지남';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
  }

  // -------- Geo --------

  // Great-circle distance in METERS between two {lat, lng} points.
  // Earth radius 6,371,000 m. Accurate to ~0.5% for typical travel distances.
  function haversine(a, b) {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sa = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(sa));
  }
  function toRad(d) { return d * Math.PI / 180; }

  // "250m" / "1.4km"
  function formatDistance(meters) {
    if (meters == null) return '';
    return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
  }

  // -------- Itinerary --------

  // Tag → marker / badge color. Same palette as map.js so cards & markers stay
  // visually aligned. Falls back to primary pink for unknown tags.
  const TAG_COLORS = {
    food: '#fb7185', walk: '#60a5fa', shop: '#c084fc',
    attraction: '#fbbf24', hotel: '#4ade80', cruise: '#06b6d4',
    transport: '#94a3b8', flight: '#f43f5e', rest: '#a78bfa',
  };
  function tagColor(tag) {
    return TAG_COLORS[tag] || '#ff6b9d';
  }

  // -------- String --------

  // Sanitize a string for use as a stable Firestore document ID.
  // Keeps Korean letters, ASCII alphanumerics, and dashes; strips other
  // punctuation so e.g. '여권 (사진)' → '여권-사진'.
  function slug(s) {
    return String(s)
      .replace(/[\/]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[()[\]{}.,;:!?"'`]/g, '')
      .toLowerCase()
      .slice(0, 80);
  }

  return {
    escape, localDateStr, parseTimeToMin, weekdayOf,
    formatTime, formatAge, formatCountdown,
    haversine, formatDistance,
    tagColor, slug,
  };
})();
