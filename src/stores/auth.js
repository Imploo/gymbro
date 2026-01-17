import { defineStore } from "pinia";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider, getMessagingIfSupported } from "../firebase";
import { getToken } from "firebase/messaging";

const defaultPreferences = {
  barWeight: 20,
  plateConfig: [20, 15, 10, 5, 2.5, 1.25],
  notificationsEnabled: false,
  restTimerSeconds: 90,
};

const isE2E = import.meta.env.VITE_E2E === "true";
const storageKeys = {
  user: "gymbro.e2e.user",
  profile: "gymbro.e2e.profile",
};

const readStorage = (key) => {
  if (!isE2E || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const writeStorage = (key, value) => {
  if (!isE2E || typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const clearStorage = () => {
  if (!isE2E || typeof window === "undefined") return;
  window.localStorage.removeItem(storageKeys.user);
  window.localStorage.removeItem(storageKeys.profile);
};

const buildProfile = (user, existing) => ({
  profile: {
    displayName: existing?.profile?.displayName ?? user?.displayName ?? "",
    email: existing?.profile?.email ?? user?.email ?? "",
    photoURL: existing?.profile?.photoURL ?? user?.photoURL ?? "",
  },
  preferences: existing?.preferences ?? defaultPreferences,
  isAdmin: existing?.isAdmin === true,
});

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    profile: null,
    initialized: false,
    loading: false,
  }),
  getters: {
    isAdmin: (state) => state.profile?.isAdmin === true,
    preferences: (state) => ({
      ...defaultPreferences,
      ...(state.profile?.preferences ?? {}),
    }),
  },
  actions: {
    async init() {
      if (this.initialized) return;
      this.loading = true;
      if (isE2E) {
        const storedUser = readStorage(storageKeys.user);
        this.user = storedUser ?? null;
        if (this.user) {
          const storedProfile = readStorage(storageKeys.profile);
          this.profile = buildProfile(this.user, storedProfile);
          writeStorage(storageKeys.profile, this.profile);
        } else {
          this.profile = null;
        }
        this.initialized = true;
        this.loading = false;
        return;
      }

      await new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
          this.user = user;
          if (user) {
            await this.ensureUserDoc(user);
          } else {
            this.profile = null;
          }
          this.initialized = true;
          this.loading = false;
          resolve();
        });
      });
    },
    async ensureUserDoc(user) {
      if (isE2E) {
        const storedProfile = readStorage(storageKeys.profile);
        const profile = buildProfile(user, storedProfile);
        this.profile = profile;
        writeStorage(storageKeys.profile, profile);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const profile = {
          profile: {
            displayName: user.displayName ?? "",
            email: user.email ?? "",
            photoURL: user.photoURL ?? "",
          },
          preferences: defaultPreferences,
          isAdmin: false,
        };
        await setDoc(userRef, profile);
        this.profile = profile;
      } else {
        this.profile = snap.data();
      }
    },
    async signIn() {
      if (isE2E) {
        const user = {
          uid: "e2e-user",
          displayName: "E2E User",
          email: "e2e@example.com",
          photoURL: "",
        };
        this.user = user;
        writeStorage(storageKeys.user, user);
        await this.ensureUserDoc(user);
        return;
      }

      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        await signInWithRedirect(auth, googleProvider);
      }
    },
    async signOut() {
      if (isE2E) {
        this.user = null;
        this.profile = null;
        clearStorage();
        return;
      }

      await firebaseSignOut(auth);
      this.user = null;
      this.profile = null;
    },
    async updatePreferences(partial) {
      if (!this.user) return;
      if (isE2E) {
        const next = {
          ...this.preferences,
          ...partial,
        };
        this.profile = {
          ...this.profile,
          preferences: next,
        };
        writeStorage(storageKeys.profile, this.profile);
        return;
      }

      const userRef = doc(db, "users", this.user.uid);
      const next = {
        ...this.preferences,
        ...partial,
      };
      await updateDoc(userRef, { preferences: next });
      this.profile = {
        ...this.profile,
        preferences: next,
      };
    },
    async enableNotifications() {
      if (!this.user) return;
      if (isE2E) {
        await this.updatePreferences({ notificationsEnabled: true });
        return;
      }

      const permission = await Notification.requestPermission();
      const enabled = permission === "granted";
      await this.updatePreferences({ notificationsEnabled: enabled });

      if (enabled) {
        const messaging = await getMessagingIfSupported();
        if (messaging) {
          const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          });
          if (token) {
            const userRef = doc(db, "users", this.user.uid);
            await updateDoc(userRef, { fcmToken: token });
          }
        }
      }
    },
  },
});
