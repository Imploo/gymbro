const REST_NOTIFICATION_TAG = "gymbro-rest-timer";
const REST_NOTIFICATION_STORAGE_KEY = "gymbro.restNotificationDueAt";
let activeTimerId = null;
let visibilityListenerRegistered = false;

const ensureNotificationPermission = async () => {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

const readStoredDueAt = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REST_NOTIFICATION_STORAGE_KEY);
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch (error) {
    return null;
  }
};

const writeStoredDueAt = (timestamp) => {
  if (typeof window === "undefined") return;
  try {
    if (typeof timestamp !== "number") {
      window.localStorage.removeItem(REST_NOTIFICATION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      REST_NOTIFICATION_STORAGE_KEY,
      String(Math.floor(timestamp))
    );
  } catch (error) {
    // Ignore storage write failures (private mode, storage full, etc.)
  }
};

const clearStoredDueAt = () => writeStoredDueAt(null);

const buildNotificationPayload = (dueAt) => ({
  body: "Time for the next set.",
  icon: "/icon.svg",
  tag: REST_NOTIFICATION_TAG,
  data: {
    type: "rest",
    scheduledFor: typeof dueAt === "number" ? dueAt : null,
  },
});

const supportsNotificationTriggers = () =>
  typeof window !== "undefined" && "TimestampTrigger" in window;

const getServiceWorkerRegistration = async () => {
  if (typeof navigator === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
};

const clearActiveTimer = () => {
  if (activeTimerId) {
    clearTimeout(activeTimerId);
    activeTimerId = null;
  }
};

const checkForMissedRestNotification = async () => {
  const dueAt = readStoredDueAt();
  if (!dueAt) return;
  if (Date.now() < dueAt) return;
  clearStoredDueAt();
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  await showRestNotification();
};

const registerVisibilityListener = () => {
  if (visibilityListenerRegistered || typeof window === "undefined") return;
  visibilityListenerRegistered = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForMissedRestNotification();
    }
  });
  window.addEventListener("pageshow", () => {
    checkForMissedRestNotification();
  });
};

export const showRestNotification = async () => {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  clearActiveTimer();
  clearStoredDueAt();
  await registration.showNotification(
    "Rest is over",
    buildNotificationPayload(Date.now())
  );
};

export const cancelRestNotification = () => {
  clearActiveTimer();
  clearStoredDueAt();
};

export const scheduleRestNotification = async (delayMs) => {
  // Cancel any existing timer first
  cancelRestNotification();

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return;

  const normalizedDelay = Math.max(0, delayMs);
  const dueAt = Math.floor(Date.now() + normalizedDelay);

  if (normalizedDelay <= 0) {
    showRestNotification();
    return;
  }

  if (supportsNotificationTriggers()) {
    try {
      await registration.showNotification("Rest is over", {
        ...buildNotificationPayload(dueAt),
        showTrigger: new window.TimestampTrigger(dueAt),
      });
      return;
    } catch (error) {
      // Fall back to a page timer when triggers are unavailable.
    }
  }

  registerVisibilityListener();
  writeStoredDueAt(dueAt);
  activeTimerId = setTimeout(() => {
    const pendingDueAt = readStoredDueAt();
    if (!pendingDueAt || pendingDueAt !== dueAt) return;
    showRestNotification();
  }, normalizedDelay);
};

registerVisibilityListener();
