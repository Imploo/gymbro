export const showRestNotification = async () => {
  if (!("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Rest is over", {
    body: "Time for the next set.",
    icon: "/icon-192.png",
  });
};

export const scheduleRestNotification = (delayMs) => {
  if (delayMs <= 0) {
    showRestNotification();
    return;
  }

  setTimeout(() => {
    showRestNotification();
  }, delayMs);
};
