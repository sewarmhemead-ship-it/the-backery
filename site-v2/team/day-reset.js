// Checklist starts empty every new day (local time), also when the page stays open overnight
// or the phone brings the tab back from the background. Old days are removed from the device.
(function () {
  const DAY_KEY = /^bakery-guide-\d{4}-\d{2}-\d{2}$/;
  function cleanup() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (DAY_KEY.test(k) && k !== 'bakery-guide-' + day) localStorage.removeItem(k);
      }
    } catch {}
  }
  function checkDay() {
    if (today() === day) return;
    day = today();
    try { state = JSON.parse(localStorage.getItem('bakery-guide-' + day) || '{}'); } catch { state = {}; }
    if (!state || typeof state !== 'object') state = {};
    cleanup();
    render();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
  window.addEventListener('pageshow', checkDay);
  setInterval(checkDay, 30000);
  cleanup();
})();
