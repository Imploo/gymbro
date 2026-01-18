/* global __APP_VERSION__ */

export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `/firebase-messaging-sw.js?v=${__APP_VERSION__}`;

  navigator.serviceWorker.register(swUrl).then((registration) => {
    setInterval(() => registration.update(), 60 * 60 * 1000);

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
};
