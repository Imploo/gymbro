const ensureNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

export const showRestNotification = async () => {
  if (!("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Rest is over", {
    body: "Time for the next set.",
    icon: "/icon.svg",
  });
};

export const scheduleRestNotification = async (delayMs) => {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  if (delayMs <= 0) {
    showRestNotification();
    return;
  }

  setTimeout(() => {
    showRestNotification();
  }, delayMs);
};
