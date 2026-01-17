import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const isE2E = import.meta.env.VITE_E2E === "true";

const requiredEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const missingEnvKeys = requiredEnvKeys.filter((key) => {
  const value = import.meta.env[key];
  return typeof value !== "string" || value.trim() === "";
});

if (!isE2E && missingEnvKeys.length > 0) {
  throw new Error(
    `[firebase] Missing or empty env vars: ${missingEnvKeys.join(", ")}. ` +
    "Create a .env file with your Firebase config (see .env.example)."
  );
}

const firebaseConfig = isE2E
  ? {
    apiKey: "e2e",
    authDomain: "e2e.local",
    projectId: "e2e",
    storageBucket: "e2e.local",
    messagingSenderId: "e2e",
    appId: "e2e",
  }
  : {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY.trim(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN.trim(),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID.trim(),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET.trim(),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID.trim(),
    appId: import.meta.env.VITE_FIREBASE_APP_ID.trim(),
  };

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const getMessagingIfSupported = async () => {
  if (await isSupported()) {
    return getMessaging(app);
  }
  return null;
};
