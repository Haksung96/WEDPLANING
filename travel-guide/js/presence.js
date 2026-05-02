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

  const formatAge = Utils.formatAge;
  const haversine = Utils.haversine;

  return { start, stop, publish, getPartner, isStale, formatAge };
})();
