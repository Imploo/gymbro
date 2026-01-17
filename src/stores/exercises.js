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
  normalizeName,
  buildExerciseId,
  sortUserExercises,
  defaultExercise,
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
  }),
  actions: {
    async loadGlobalExercises() {
      if (isE2E) {
        const stored = readStorage(storageKeys.globalExercises, []);
        const next = stored.length > 0 ? stored : seedGlobalExercises();
        const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name));
        this.globalExercises = sorted;
        writeStorage(storageKeys.globalExercises, sorted);
        return;
      }

      const q = query(collection(db, "exercises"), orderBy("name"));
      const snap = await getDocs(q);
      this.globalExercises = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    },
    subscribeUserExercises() {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const sorted = sortUserExercises(stored);
        this.userExercises = sorted;
        writeStorage(storageKeys.userExercises, sorted);
        return;
      }

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
    async createExerciseFromGlobal(name) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      const trimmed = normalizeName(name);
      if (!trimmed) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const next = sortUserExercises([
          ...stored,
          {
            id: buildExerciseId(),
            name: trimmed,
            ...defaultExercise,
            warmupEnabled: true,
          },
        ]);
        this.userExercises = next;
        writeStorage(storageKeys.userExercises, next);
        return;
      }

      await addDoc(collection(db, "users", auth.user.uid, "exercises"), {
        name: trimmed,
        ...defaultExercise,
        warmupEnabled: true,
      });
    },
    async createCustomExercise(name) {
      return this.createExerciseFromGlobal(name);
    },
    async updateExercise(exerciseId, patch) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const next = sortUserExercises(
          stored.map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, ...patch } : exercise
          )
        );
        this.userExercises = next;
        writeStorage(storageKeys.userExercises, next);
        return;
      }

      const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
      await updateDoc(ref, patch);
    },
    async updateExerciseByUser(userId, exerciseId, patch) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (!userId || !exerciseId) return;
      if (isE2E) {
        if (userId !== auth.user?.uid) return;
        await this.updateExercise(exerciseId, patch);
        return;
      }

      const ref = doc(db, "users", userId, "exercises", exerciseId);
      await updateDoc(ref, patch);
    },
    async deleteUserExercise(exerciseId) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (!exerciseId) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const next = sortUserExercises(stored.filter((exercise) => exercise.id !== exerciseId));
        this.userExercises = next;
        writeStorage(storageKeys.userExercises, next);
        return;
      }

      const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
      await deleteDoc(ref);
    },
    async addHistoryEntry(exerciseId, entry) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (isE2E) {
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
        return;
      }

      const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
      await updateDoc(ref, { history: arrayUnion(entry) });
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
      const trimmed = normalizeName(name);
      if (!trimmed) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.globalExercises, []);
        const exists = stored.some(
          (exercise) => exercise.name.toLowerCase() === trimmed.toLowerCase()
        );
        const next = exists
          ? stored
          : [
              ...stored,
              {
                id: `global-${trimmed.toLowerCase().replace(/\s+/g, "-")}`,
                name: trimmed,
              },
            ];
        const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name));
        this.globalExercises = sorted;
        writeStorage(storageKeys.globalExercises, sorted);
        return;
      }

      await addDoc(collection(db, "exercises"), { name: trimmed });
    },
    async loadAdminExercises() {
      if (isE2E) {
        await this.loadGlobalExercises();
        return;
      }

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
  },
});
