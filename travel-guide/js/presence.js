// Real-time spouse location sharing via Firestore.
// Each user publishes their current position; the partner subscribes and
// sees a colored marker on the map.

const Presence = (() => {
  const PUBLISH_INTERVAL = 30 * 1000;  // 30s — keep light on Firestore quota
  const STALE_AFTER = 5 * 60 * 1000;   // 5 min → treat as offline
  let publishTimer = null;
  let lastPosition = null;
  let partnerData = null;
  let onPartnerUpdate = null;

  function start(getPosition, onPartner) {
    onPartnerUpdate = onPartner;

    // Publish my position periodically
    publishTimer = setInterval(() => {
      const pos = getPosition();
      if (!pos) return;
      // Skip if barely moved (< 20m) AND last publish was recent (< 2 min)
      if (lastPosition &&
          haversine(pos, lastPosition) < 20 &&
          Date.now() - lastPosition.publishedAt < 120000) return;
      publish(pos);
    }, PUBLISH_INTERVAL);

    // Publish once immediately when first position is available
    const firstPublish = setInterval(() => {
      const pos = getPosition();
      if (pos) {
        publish(pos);
        clearInterval(firstPublish);
      }
    }, 1500);
    setTimeout(() => clearInterval(firstPublish), 30000);

    // Subscribe to partner's position
    Sync.subscribe('presence', (items) => {
      const me = Sync.getUser().name;
      // Find the most recent entry that's NOT me
      let latest = null;
      Object.entries(items).forEach(([name, data]) => {
        if (name === me) return;
        if (!latest || (data._updatedAt || 0) > (latest._updatedAt || 0)) {
          latest = { name, ...data };
        }
      });
      partnerData = latest;
      if (onPartnerUpdate) onPartnerUpdate(latest);
    });
  }

  function publish(pos) {
    const me = Sync.getUser().name;
    Sync.setItem('presence', me, {
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy || null,
    });
    lastPosition = { ...pos, publishedAt: Date.now() };
  }

  function stop() {
    if (publishTimer) clearInterval(publishTimer);
    publishTimer = null;
  }

  function getPartner() { return partnerData; }

  function isStale(data) {
    if (!data || !data._updatedAt) return true;
    return Date.now() - data._updatedAt > STALE_AFTER;
  }

  function formatAge(updatedAt) {
    if (!updatedAt) return '';
    const ageSec = Math.floor((Date.now() - updatedAt) / 1000);
    if (ageSec < 60) return `${ageSec}초 전`;
    const ageMin = Math.floor(ageSec / 60);
    if (ageMin < 60) return `${ageMin}분 전`;
    const ageHr = Math.floor(ageMin / 60);
    return `${ageHr}시간 ${ageMin % 60}분 전`;
  }

  function haversine(a, b) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sa = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(sa));
  }

  return { start, stop, publish, getPartner, isStale, formatAge };
})();
