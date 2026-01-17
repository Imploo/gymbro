import { defineStore } from "pinia";
import {
  addDoc,
  collection,
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

const defaultExercise = {
  status: "active",
  currentWeight: 20,
  warmupEnabled: false,
  setsTarget: 5,
  setsDone: 0,
  warmupSetIndex: 0,
  lastCompletedAt: null,
  timerEndsAt: null,
};

export const useExercisesStore = defineStore("exercises", {
  state: () => ({
    globalExercises: [],
    userExercises: [],
    loading: false,
    unsubscribeUser: null,
  }),
  actions: {
    async loadGlobalExercises() {
      const q = query(collection(db, "exercises"), orderBy("name"));
      const snap = await getDocs(q);
      this.globalExercises = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    },
    subscribeUserExercises() {
      const auth = useAuthStore();
      if (!auth.user) return;
      this.unsubscribeUser?.();
      const q = query(
        collection(db, "users", auth.user.uid, "exercises"),
        orderBy("name")
      );
      this.unsubscribeUser = onSnapshot(q, (snap) => {
        this.userExercises = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
      });
    },
    async createExerciseFromGlobal(name) {
      const auth = useAuthStore();
      if (!auth.user) return;
      await addDoc(collection(db, "users", auth.user.uid, "exercises"), {
        name,
        ...defaultExercise,
      });
    },
    async createCustomExercise(name) {
      return this.createExerciseFromGlobal(name);
    },
    async updateExercise(exerciseId, patch) {
      const auth = useAuthStore();
      if (!auth.user) return;
      const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
      await updateDoc(ref, patch);
    },
    async completeSet(exercise) {
      const auth = useAuthStore();
      const restSeconds = Number(auth.preferences.restTimerSeconds);
      const restTimerMs = Number.isFinite(restSeconds)
        ? Math.max(0, restSeconds) * 1000
        : 90_000;
      const nextSetsDone = exercise.setsDone + 1;
      const update = {
        setsDone: nextSetsDone,
        timerEndsAt: restTimerMs > 0 ? Date.now() + restTimerMs : null,
      };

      if (exercise.warmupEnabled) {
        const nextWarmup = exercise.warmupSetIndex + 1;
        update.warmupSetIndex = nextWarmup;
        const warmupWeight = exercise.currentWeight / 2 + nextWarmup * 10;
        if (warmupWeight >= exercise.currentWeight) {
          update.warmupEnabled = false;
        }
      }

      await this.updateExercise(exercise.id, update);
    },
    async finishExercise(exercise) {
      const update = {
        currentWeight: exercise.currentWeight + 2.5,
        setsDone: 0,
        warmupEnabled: false,
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
    async loadAdminExercises() {
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
