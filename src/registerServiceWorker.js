export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((registration) => {
        let reloading = false;

        const promptForUpdate = () => {
          const shouldReload = window.confirm(
            "A new version is available. Reload now?"
          );
          if (!shouldReload) return;
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        };

        if (registration.waiting && navigator.serviceWorker.controller) {
          promptForUpdate();
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptForUpdate();
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });
      })
      .catch(() => {
        // Registration failure is non-fatal for app usage.
      });
  });
};
