/* global __APP_VERSION__ */

export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `/firebase-messaging-sw.js?v=${__APP_VERSION__}`;
  let updateNotified = false;

  const notifyUpdate = (registration) => {
    if (updateNotified) return;
    if (!navigator.serviceWorker.controller) return;
    if (!registration?.waiting) return;
    updateNotified = true;
    window.dispatchEvent(
      new CustomEvent("sw-update", {
        detail: { registration },
      })
    );
  };

  navigator.serviceWorker.register(swUrl).then((registration) => {
    setInterval(() => registration.update(), 60 * 60 * 1000);

    if (registration.waiting) {
      notifyUpdate(registration);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          notifyUpdate(registration);
        }
      });
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    if (document.visibilityState === "visible") {
      window.location.reload();
      return;
    }
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.location.reload();
    };
    document.addEventListener("visibilitychange", handleVisibility);
  });
};
