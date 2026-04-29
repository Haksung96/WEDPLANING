// Re-boarding countdown — critical safety feature for cruise port days.
// On port days, finds the latest "transport" or "cruise" event with a time
// and shows a prominent countdown urging the user to head back.

const Reboarding = (() => {
  let updateTimer = null;

  // Heuristic: events with these tags + late-day timing are the "must be back" deadline
  const RETURN_TAGS = ['transport', 'cruise'];
  // Keywords that indicate the re-boarding deadline event
  const RETURN_KEYWORDS = ['재승선', '복귀', '항구 복귀', '항구 방면', '복귀 시작', '재승선 마감'];

  function findReturnDeadline(day) {
    if (!day || !day.events) return null;
    // Cruise port days are characterized by NOT being in Barcelona/At Sea
    // and having multiple time-stamped events.
    const isPortDay = day.city && day.city !== 'Barcelona' && day.city !== 'At Sea';
    if (!isPortDay) return null;

    // Find latest event with return-relevant keywords or transport/cruise tags
    let candidate = null;
    for (let i = day.events.length - 1; i >= 0; i--) {
      const evt = day.events[i];
      const m = String(evt.time || '').match(/^(\d{1,2}):(\d{2})/);
      if (!m) continue;
      const lower = (evt.title + ' ' + (evt.desc || '')).toLowerCase();
      const titleHit = RETURN_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
      const tagHit = RETURN_TAGS.includes(evt.tag);
      if (titleHit || tagHit) {
        candidate = { ...evt, hour: Number(m[1]), minute: Number(m[2]), index: i };
        break;
      }
    }
    return candidate;
  }

  function start(getCurrentDay, render) {
    if (updateTimer) clearInterval(updateTimer);
    const tick = () => {
      const day = getCurrentDay();
      const deadline = findReturnDeadline(day);
      render(deadline ? compute(deadline) : null);
    };
    tick();
    updateTimer = setInterval(tick, 30000);  // every 30s
  }

  function compute(deadline) {
    const now = new Date();
    const minsUntil = (deadline.hour * 60 + deadline.minute) - (now.getHours() * 60 + now.getMinutes());

    let urgency = 'normal';   // > 60 min
    if (minsUntil < 0) urgency = 'past';
    else if (minsUntil <= 30) urgency = 'critical';
    else if (minsUntil <= 60) urgency = 'warning';

    return {
      title: deadline.title,
      time: deadline.time,
      desc: deadline.desc,
      minsUntil,
      urgency,
    };
  }

  function stop() {
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = null;
  }

  return { start, stop, findReturnDeadline };
})();
