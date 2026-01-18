import { defineStore } from "pinia";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { withPersistence } from "../utils/storeHelpers";

export const usePartnerExerciseStore = defineStore("partnerExercise", {
  state: () => ({
    partnerExercise: null,
    unsubscribePartnerExercise: null,
  }),
  actions: {
    subscribePartnerExercise(uid, exerciseId) {
      this.unsubscribePartnerExercise?.();
      if (!uid || !exerciseId) {
        this.partnerExercise = null;
        return;
      }
      return withPersistence({
        e2e: () => {
          this.partnerExercise = null;
        },
        remote: () => {
          const ref = doc(db, "users", uid, "exercises", exerciseId);
          this.unsubscribePartnerExercise = onSnapshot(ref, (snap) => {
            this.partnerExercise = snap.exists()
              ? { id: snap.id, ...snap.data() }
              : null;
          });
        },
      });
    },
  },
});
