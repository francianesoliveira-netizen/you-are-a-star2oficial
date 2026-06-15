export function registerPWA() {
  // Do not register a service worker in this build.
  // iOS PWAs can keep old cached JS aggressively; this build clears old workers/caches
  // and relies on the browser network cache so the keyboard/input behavior stays fresh.
  if (typeof window === "undefined") return;
  window.addEventListener("load", async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (err) {
      console.warn("PWA cleanup skipped", err);
    }
  });
}
