import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteToken, getToken } from "firebase/messaging";
import { db, getMessagingIfSupported } from "../firebase";

const ensureNotificationPermission = async (shouldPrompt) => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (!shouldPrompt || Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

const getVapidKey = () => {
  const key = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (typeof key !== "string") return "";
  return key.trim();
};

export const registerFcmToken = async ({ userId, shouldPrompt = false }) => {
  if (!userId) return false;
  const permissionGranted = await ensureNotificationPermission(shouldPrompt);
  if (!permissionGranted) return false;

  const messaging = await getMessagingIfSupported();
  if (!messaging) return false;

  const vapidKey = getVapidKey();
  if (!vapidKey) {
    console.warn("[notifications] Missing VAPID key for FCM.");
    return false;
  }

  const token = await getToken(messaging, { vapidKey });
  if (!token) return false;

  await setDoc(
    doc(db, "users", userId, "tokens", token),
    {
      token,
      createdAt: serverTimestamp(),
      platform: "web",
    },
    { merge: true }
  );

  return true;
};

export const unregisterFcmToken = async ({ userId }) => {
  if (!userId) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const messaging = await getMessagingIfSupported();
  if (!messaging) return;

  const vapidKey = getVapidKey();
  if (!vapidKey) return;

  try {
    const token = await getToken(messaging, { vapidKey });
    if (!token) return;
    await deleteToken(messaging);
    await deleteDoc(doc(db, "users", userId, "tokens", token));
  } catch (error) {
    console.warn("[notifications] Failed to unregister token", error);
  }
};
