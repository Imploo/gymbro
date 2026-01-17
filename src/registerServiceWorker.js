/* global __APP_VERSION__ */

export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const appVersion =
      typeof __APP_VERSION__ === "string" && __APP_VERSION__.length > 0
        ? __APP_VERSION__
        : "dev";
    const swUrl = `/firebase-messaging-sw.js?v=${appVersion}`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        let reloading = false;
        let updatePrompted = false;

        const promptForUpdate = () => {
          if (updatePrompted) return;
          updatePrompted = true;
          window.dispatchEvent(
            new CustomEvent("sw-update", {
              detail: { registration },
            })
          );
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
