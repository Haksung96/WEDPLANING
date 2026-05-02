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

  // Audible beep using Web Audio API — no asset, works offline.
  // freq = 880 Hz, durationMs = total length, pulses = how many short blips.
  let audioCtx = null;
  function beep(freq = 880, durationMs = 250, pulses = 1) {
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      // iOS suspends AudioContext until first user gesture.
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const pulseLen = durationMs / (pulses * 2);
      for (let i = 0; i < pulses; i++) {
        const startAt = audioCtx.currentTime + (i * pulseLen * 2) / 1000;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        osc.connect(gain).connect(audioCtx.destination);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.6, startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + pulseLen / 1000);
        osc.start(startAt);
        osc.stop(startAt + pulseLen / 1000 + 0.02);
      }
    } catch {}
  }

  // Combined alert: vibration + beep + (optional) push notification.
  // Used for re-boarding deadline thresholds (5/15/30/60 min).
  function alarm(level) {
    const profiles = {
      info:    { vib: [60, 40, 60], freq: 880,  dur: 200, pulses: 2 },
      warning: { vib: [120, 80, 120, 80, 120], freq: 660, dur: 350, pulses: 3 },
      urgent:  { vib: [200, 100, 200, 100, 200, 100, 200], freq: 440, dur: 600, pulses: 4 },
    };
    const p = profiles[level] || profiles.info;
    if (navigator.vibrate) {
      try { navigator.vibrate(p.vib); } catch {}
    }
    beep(p.freq, p.dur, p.pulses);
  }

  return { tap, beep, alarm, bindHaptic, bindSwipe, disableDoubleTapZoom };
})();
