/* global __APP_VERSION__ */

export const registerServiceWorker = () => {
  // Unregister any existing service workers to resolve flickering issues
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {
          // Ignore errors
        });
      }
    });
  }
};
