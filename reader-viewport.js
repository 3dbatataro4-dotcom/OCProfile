/* Browser chrome changes the visible viewport without always updating vh.
   Keep full-window reading surfaces sized to it; preserve native pinch zoom. */
(() => {
  const sync = () => {
    const viewport = window.visualViewport;
    if ((viewport?.scale || 1) > 1.04) return;
    document.documentElement.style.setProperty('--oc-reader-height', `${viewport?.height || innerHeight}px`);
  };
  window.addEventListener('resize', sync);
  window.addEventListener('pageshow', sync);
  window.visualViewport?.addEventListener('resize', sync);
  document.addEventListener('fullscreenchange', sync);
  sync();
})();
