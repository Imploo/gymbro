import { defineStore } from "pinia";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { DEFAULT_PLATE_COLORS } from "../utils/plateColors";
import { registerFcmToken, unregisterFcmToken } from "../utils/notifications";
import { clearStorage, readStorage, withPersistence, writeStorage } from "../utils/storeHelpers";

const defaultPreferences = {
  barWeight: 20,
  plateConfig: [20, 15, 10, 5, 2.5, 1.25],
  plateColors: DEFAULT_PLATE_COLORS,
  notificationsEnabled: false,
  restTimerSeconds: 90,
};

const storageKeys = {
  user: "gymbro.e2e.user",
  profile: "gymbro.e2e.profile",
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
    async syncNotificationToken({ shouldPrompt = false } = {}) {
      if (!this.user) return false;
      const enabled = this.preferences.notificationsEnabled;
      if (!enabled && !shouldPrompt) return false;
      const registered = await registerFcmToken({
        userId: this.user.uid,
        shouldPrompt: shouldPrompt || enabled,
      });
      if (shouldPrompt && registered !== enabled) {
        await this.updatePreferences({ notificationsEnabled: registered });
      }
      return registered;
    },
    async init() {
      if (this.initialized) return;
      this.loading = true;
      await withPersistence({
        e2e: () => {
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
        },
        remote: async () => {
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
      });
    },
    async ensureUserDoc(user) {
      await withPersistence({
        e2e: () => {
          const storedProfile = readStorage(storageKeys.profile);
          const profile = buildProfile(user, storedProfile);
          this.profile = profile;
          writeStorage(storageKeys.profile, profile);
        },
        remote: async () => {
          const userRef = doc(db, "users", user.uid);
          try {
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
            await this.syncNotificationToken();
          } catch (error) {
            console.error("[auth] Failed to load user profile", error);
            window.alert("We could not load your profile. Try again shortly.");
            this.profile = buildProfile(user, null);
          }
        },
      });
    },
    async signIn() {
      await withPersistence({
        e2e: async () => {
          const user = {
            uid: "e2e-user",
            displayName: "E2E User",
            email: "e2e@example.com",
            photoURL: "",
          };
          this.user = user;
          writeStorage(storageKeys.user, user);
          await this.ensureUserDoc(user);
        },
        remote: async () => {
          try {
            await signInWithPopup(auth, googleProvider);
          } catch (error) {
            console.warn("[auth] Popup sign-in failed", error);
            const code = error?.code ?? "";
            if (code === "auth/popup-closed-by-user" || code === "auth/popup-blocked") {
              await signInWithRedirect(auth, googleProvider);
              return;
            }
            window.alert("Sign-in failed. Please try again.");
            throw error;
          }
        },
      });
    },
    async signOut() {
      await withPersistence({
        e2e: () => {
          this.user = null;
          this.profile = null;
          clearStorage([storageKeys.user, storageKeys.profile]);
        },
        remote: async () => {
          if (this.user) {
            await unregisterFcmToken({ userId: this.user.uid });
          }
          await firebaseSignOut(auth);
          this.user = null;
          this.profile = null;
        },
      });
    },
    async updatePreferences(partial) {
      if (!this.user) return;
      await withPersistence({
        e2e: () => {
          const next = {
            ...this.preferences,
            ...partial,
          };
          this.profile = {
            ...this.profile,
            preferences: next,
          };
          writeStorage(storageKeys.profile, this.profile);
        },
        remote: async () => {
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
      });
    },
    async enableNotifications() {
      if (!this.user) return;
      await withPersistence({
        e2e: async () => {
          await this.updatePreferences({ notificationsEnabled: true });
        },
        remote: async () => {
          try {
            const enabled = await this.syncNotificationToken({ shouldPrompt: true });
            await this.updatePreferences({ notificationsEnabled: enabled });
          } catch (error) {
            console.error("[auth] Notifications permission failed", error);
            window.alert("Unable to enable notifications right now.");
          }
        },
      });
    },
  },
});
