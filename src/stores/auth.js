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
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        await signInWithRedirect(auth, googleProvider);
      }
    },
    async signOut() {
      await firebaseSignOut(auth);
      this.user = null;
      this.profile = null;
    },
    async updatePreferences(partial) {
      if (!this.user) return;
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
