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

let activeTimerId = null;

export const cancelRestNotification = () => {
  if (activeTimerId) {
    clearTimeout(activeTimerId);
    activeTimerId = null;
  }
};

export const scheduleRestNotification = async (delayMs) => {
  cancelRestNotification();

  const granted = await ensureNotificationPermission();
  if (!granted) return;
  if (delayMs <= 0) {
    showRestNotification();
    return;
  }

  activeTimerId = setTimeout(() => {
    showRestNotification();
    activeTimerId = null;
  }, delayMs);
};
