// Mobile UX helpers — haptic feedback + swipe gesture for day navigation.

const Mobile = (() => {
  // Haptic-style feedback using Vibration API (Android) or visual fallback.
  function tap(strength = 'light') {
    if (!navigator.vibrate) return;
    const patterns = {
      light: 10,
      medium: 25,
      heavy: 50,
      success: [15, 30, 15],
      error: [40, 60, 40],
    };
    try { navigator.vibrate(patterns[strength] || 10); } catch {}
  }

  // Wrap target buttons/elements so taps automatically trigger haptic.
  function bindHaptic() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.nav-btn, .day-pill, .pill-btn, .more-item, .btn-primary, .btn-secondary, input[type="checkbox"]');
      if (!target) return;
      tap('light');
    }, true);
  }

  // Swipe gesture between days on Today view.
  function bindSwipe(onSwipeLeft, onSwipeRight) {
    let startX = 0, startY = 0, startT = 0;
    const root = document.getElementById('view-today');
    if (!root) return;

    root.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
    }, { passive: true });

    root.addEventListener('touchend', (e) => {
      if (e.changedTouches.length !== 1) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;
      const dt = Date.now() - startT;

      // Horizontal swipe: > 60px, mostly horizontal, completed in < 500ms
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
        if (dx < 0) {
          tap('medium');
          onSwipeLeft();
        } else {
          tap('medium');
          onSwipeRight();
        }
      }
    }, { passive: true });
  }

  // Prevent iOS double-tap zoom on UI elements
  function disableDoubleTapZoom() {
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch < 300 && e.target.closest('button, .pill-btn, .nav-btn, label')) {
        e.preventDefault();
      }
      lastTouch = now;
    }, { passive: false });
  }

  return { tap, bindHaptic, bindSwipe, disableDoubleTapZoom };
})();
