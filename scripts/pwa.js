// scripts/pwa.js - Service worker registration

(function () {
  if (!("serviceWorker" in navigator)) return;

  // Only works on https or localhost. (file:// cannot register SW)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      // ignore
    });
  });
})();
