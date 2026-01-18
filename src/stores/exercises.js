import { defineStore } from "pinia";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuthStore } from "./auth";
import {
  isE2E,
  storageKeys,
  readStorage,
  writeStorage,
  sanitizeName,
  buildExerciseId,
  sortUserExercises,
  defaultExercise,
  withPersistence,
} from "../utils/storeHelpers";

const seedGlobalExercises = () => [
  { id: "global-bench", name: "Bench Press" },
  { id: "global-deadlift", name: "Deadlift" },
  { id: "global-ohp", name: "Overhead Press" },
  { id: "global-squat", name: "Squat" },
];

export const useExercisesStore = defineStore("exercises", {
  state: () => ({
    globalExercises: [],
    userExercises: [],
    loading: false,
    unsubscribeUser: null,
    unsubscribeGlobal: null,
  }),
  actions: {
    async subscribeGlobalExercises() {
      await withPersistence({
        e2e: () => {
          const stored = readStorage(storageKeys.globalExercises, []);
          const next = stored.length > 0 ? stored : seedGlobalExercises();
          const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name));
          this.globalExercises = sorted;
          writeStorage(storageKeys.globalExercises, sorted);
        },
        remote: async () => {
          this.unsubscribeGlobal?.();
          const q = query(collection(db, "exercises"), orderBy("name"));
          this.unsubscribeGlobal = onSnapshot(q, (snap) => {
            this.globalExercises = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }));
          });
        },
      });
    },
    subscribeUserExercises() {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      return withPersistence({
        e2e: () => {
          const stored = readStorage(storageKeys.userExercises, []);
          const sorted = sortUserExercises(stored);
          this.userExercises = sorted;
          writeStorage(storageKeys.userExercises, sorted);
        },
        remote: () => {
          this.unsubscribeUser?.();
          const q = query(
            collection(db, "users", auth.user.uid, "exercises"),
            orderBy("name")
          );
          this.unsubscribeUser = onSnapshot(q, (snap) => {
            const next = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }));
            this.userExercises = sortUserExercises(next);
          });
        },
      });
    },
    async createExerciseFromGlobal(name) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      const sanitized = sanitizeName(name);
      if (!sanitized) return;
      await withPersistence({
        e2e: () => {
          const stored = readStorage(storageKeys.userExercises, []);
          const next = sortUserExercises([
            ...stored,
            {
              id: buildExerciseId(),
              name: sanitized,
              ...defaultExercise,
              warmupEnabled: true,
            },
          ]);
          this.userExercises = next;
          writeStorage(storageKeys.userExercises, next);
        },
        remote: async () => {
          await addDoc(collection(db, "users", auth.user.uid, "exercises"), {
            name: sanitized,
            ...defaultExercise,
            warmupEnabled: true,
          });
        },
      });
    },
    async createCustomExercise(name) {
      return this.createExerciseFromGlobal(name);
    },
    async updateExercise(exerciseId, patch) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      await withPersistence({
        e2e: () => {
          const stored = readStorage(storageKeys.userExercises, []);
          const next = sortUserExercises(
            stored.map((exercise) =>
              exercise.id === exerciseId ? { ...exercise, ...patch } : exercise
            )
          );
          this.userExercises = next;
          writeStorage(storageKeys.userExercises, next);
        },
        remote: async () => {
          const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
          await updateDoc(ref, patch);
        },
      });
    },
    async updateExerciseByUser(userId, exerciseId, patch) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (!userId || !exerciseId) return;
      await withPersistence({
        e2e: async () => {
          if (userId !== auth.user?.uid) return;
          await this.updateExercise(exerciseId, patch);
        },
        remote: async () => {
          const ref = doc(db, "users", userId, "exercises", exerciseId);
          await updateDoc(ref, patch);
        },
      });
    },
    async deleteUserExercise(exerciseId) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (!exerciseId) return;
      await withPersistence({
        e2e: () => {
          const stored = readStorage(storageKeys.userExercises, []);
          const next = sortUserExercises(
            stored.filter((exercise) => exercise.id !== exerciseId)
          );
          this.userExercises = next;
          writeStorage(storageKeys.userExercises, next);
        },
        remote: async () => {
          const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
          await deleteDoc(ref);
        },
      });
    },
    async addHistoryEntry(exerciseId, entry) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      await withPersistence({
        e2e: () => {
          const stored = readStorage(storageKeys.userExercises, []);
          const next = sortUserExercises(
            stored.map((exercise) => {
              if (exercise.id !== exerciseId) return exercise;
              const history = Array.isArray(exercise.history) ? exercise.history : [];
              return { ...exercise, history: [...history, entry] };
            })
          );
          this.userExercises = next;
          writeStorage(storageKeys.userExercises, next);
        },
        remote: async () => {
          const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
          await updateDoc(ref, { history: arrayUnion(entry) });
        },
      });
    },
    async completeSet(exercise) {
      const auth = useAuthStore();
      const restSeconds = Number(auth.preferences.restTimerSeconds);
      const restTimerMs = Number.isFinite(restSeconds)
        ? Math.max(0, restSeconds) * 1000
        : 90_000;
      const update = {};

      if (exercise.warmupEnabled) {
        update.timerEndsAt = restTimerMs > 0 ? Date.now() + restTimerMs : null;
        const nextWarmup = exercise.warmupSetIndex + 1;
        update.warmupSetIndex = nextWarmup;
        const warmupWeight = exercise.currentWeight / 2 + nextWarmup * 10;
        if (warmupWeight >= exercise.currentWeight) {
          update.warmupEnabled = false;
        }
      } else {
        const nextSetsDone = exercise.setsDone + 1;
        if (nextSetsDone >= exercise.setsTarget) {
          await this.finishExercise(exercise, { addWeight: true, success: true });
          return true;
        }
        update.setsDone = nextSetsDone;
        update.timerEndsAt = restTimerMs > 0 ? Date.now() + restTimerMs : null;
      }

      await this.updateExercise(exercise.id, update);
      return false;
    },
    async finishExercise(exercise, { addWeight = true, success = false } = {}) {
      await this.addHistoryEntry(exercise.id, {
        at: Date.now(),
        weight: exercise.currentWeight,
        success,
      });
      const update = {
        currentWeight: exercise.currentWeight + (addWeight ? 2.5 : 0),
        setsDone: 0,
        warmupEnabled: true,
        warmupSetIndex: 0,
        lastCompletedAt: Date.now(),
      };
      await this.updateExercise(exercise.id, update);
    },
    async toggleWarmup(exercise) {
      const update = {
        warmupEnabled: !exercise.warmupEnabled,
        warmupSetIndex: 0,
      };
      await this.updateExercise(exercise.id, update);
    },
    async addGlobalExercise(name) {
      const sanitized = sanitizeName(name);
      if (!sanitized) return;
      await withPersistence({
        e2e: () => {
          const stored = readStorage(storageKeys.globalExercises, []);
          const exists = stored.some(
            (exercise) => exercise.name.toLowerCase() === sanitized.toLowerCase()
          );
          const next = exists
            ? stored
            : [
              ...stored,
              {
                id: `global-${sanitized.toLowerCase().replace(/\s+/g, "-")}`,
                name: sanitized,
              },
            ];
          const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name));
          this.globalExercises = sorted;
          writeStorage(storageKeys.globalExercises, sorted);
        },
        remote: async () => {
          await addDoc(collection(db, "exercises"), { name: sanitized });
        },
      });
    },
    async loadAdminExercises() {
      await withPersistence({
        e2e: async () => {
          await this.subscribeGlobalExercises();
        },
        remote: async () => {
          const q = query(
            collection(db, "exercises"),
            where("name", "!=", "")
          );
          const snap = await getDocs(q);
          this.globalExercises = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
        },
      });
    },
  },
});
