import { GymBro } from "./gymbro";
import { toggleWarmupForTarget } from "../../utils/training-helpers";

export class SessionWorkoutStrategy {
  getActiveUid({ auth, sharedSession }) {
    return sharedSession?.activeUid ?? auth.user?.uid;
  }

  getActiveExercise({ auth, sharedSession, exercise, partnerExercise, activeUid }) {
    if (!sharedSession) return exercise;
    const currentUid = activeUid ?? sharedSession.activeUid ?? auth.user?.uid;
    if (currentUid === auth.user?.uid) return exercise;
    return partnerExercise;
  }

  getActiveTarget({ auth, sharedSession, exercise, activeUid }) {
    if (!sharedSession) {
      return { userId: auth.user?.uid, exerciseId: exercise?.id };
    }
    const userId = activeUid ?? sharedSession.activeUid ?? auth.user?.uid;
    const exerciseId = sharedSession.participants?.[userId]?.exerciseId;
    return { userId, exerciseId };
  }

  getRestTimerOwnerExercise({ auth, sharedSession, exercise, partnerExercise }) {
    if (!sharedSession) return exercise;
    if (sharedSession.primaryUid === auth.user?.uid) return exercise;
    return partnerExercise;
  }

  getActiveParticipantLabel({ auth, sharedSession, activeUid, partnerProfile }) {
    if (!sharedSession) return "";
    if (activeUid === auth.user?.uid) return "You";
    return partnerProfile?.displayName || "Partner";
  }

  async completeSet({ auth, sharedSessionStore, exercise, restTimerMs, exercises }) {
    const session = sharedSessionStore.sharedSession;
    if (!exercise) {
      return { finished: false, shouldNavigate: false, shouldScheduleRest: false };
    }
    if (!session) {
      const currentBro = GymBro.createSolo({
        uid: auth.user?.uid,
        exerciseData: exercise,
        exerciseRef: null,
      });
      const update = currentBro.performSet();
      if (!update) {
        return { finished: false, shouldNavigate: false, shouldScheduleRest: false };
      }
      const nextBro = currentBro.advance();
      const finished = !nextBro;

      if (finished) {
        await exercises.finishExercise(
          { ...exercise, ...update },
          { success: true }
        );
        return { finished: true, shouldNavigate: true, shouldScheduleRest: false };
      }

      const timerEndsAt = restTimerMs > 0 ? Date.now() + restTimerMs : null;
      await exercises.updateExercise(exercise.id, { ...update, timerEndsAt });
      return {
        finished: false,
        shouldNavigate: false,
        shouldScheduleRest: restTimerMs > 0,
      };
    }

    const { finished, shouldFinishSession } = await sharedSessionStore.completeSharedSet(
      session,
      exercise
    );
    const shouldScheduleRest =
      restTimerMs > 0 &&
      session.primaryUid === auth.user?.uid &&
      !shouldFinishSession;
    return { finished, shouldNavigate: shouldFinishSession, shouldScheduleRest };
  }

  async toggleWarmup({ activeExercise, exercises, target }) {
    await toggleWarmupForTarget({ activeExercise, exercises, target });
  }

  async finishExercise({ sharedSessionStore, sharedSuccess, exercise, exercises }) {
    if (sharedSessionStore.sharedSession) {
      await sharedSessionStore.finishSharedSession(sharedSessionStore.sharedSession, {
        success: sharedSuccess,
      });
      return { shouldNavigate: true };
    }
    if (!exercise) return { shouldNavigate: false };
    await exercises.finishExercise(exercise, { success: false, addWeight: false });
    return { shouldNavigate: true };
  }
}

export const sessionWorkoutStrategy = new SessionWorkoutStrategy();
