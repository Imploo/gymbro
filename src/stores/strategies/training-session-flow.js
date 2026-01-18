import { GymBro } from "./gymbro";
import { toggleWarmupForTarget } from "../../utils/training-helpers";

export const trainingSessionFlow = {
  getActiveUid({ auth, trainingSession }) {
    return trainingSession.sharedSession?.activeUid ?? auth.user?.uid;
  },
  getActiveExercise({ auth, trainingSession, exercise, partnerExercise, activeUid }) {
    if (!trainingSession.sharedSession) return exercise;
    const currentUid =
      activeUid ?? trainingSession.sharedSession.activeUid ?? auth.user?.uid;
    if (currentUid === auth.user?.uid) return exercise;
    return partnerExercise;
  },
  getActiveTarget({ auth, trainingSession, exercise, activeUid }) {
    if (!trainingSession.sharedSession) {
      return { userId: auth.user?.uid, exerciseId: exercise?.id };
    }
    const userId =
      activeUid ?? trainingSession.sharedSession.activeUid ?? auth.user?.uid;
    const exerciseId = trainingSession.sharedSession.participants?.[userId]?.exerciseId;
    return { userId, exerciseId };
  },
  getTimerSourceExercise({ auth, trainingSession, exercise, partnerExercise }) {
    if (!trainingSession.sharedSession) return exercise;
    if (trainingSession.sharedSession.primaryUid === auth.user?.uid) return exercise;
    return partnerExercise;
  },
  getActiveParticipantLabel({ auth, trainingSession, activeUid, partnerProfile }) {
    if (!trainingSession.sharedSession) return "";
    if (activeUid === auth.user?.uid) return "You";
    return partnerProfile?.displayName || "Partner";
  },
  async completeSet({ auth, trainingSession, exercise, restTimerMs, exercises }) {
    const session = trainingSession.sharedSession;
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

    const { finished, shouldFinishSession } = await trainingSession.completeSharedSet(
      session,
      exercise
    );
    const shouldScheduleRest =
      restTimerMs > 0 && session.primaryUid === auth.user?.uid && !shouldFinishSession;
    return { finished, shouldNavigate: shouldFinishSession, shouldScheduleRest };
  },
  async toggleWarmup({ activeExercise, exercises, target }) {
    await toggleWarmupForTarget({ activeExercise, exercises, target });
  },
  async finishExercise({ trainingSession, sharedSuccess, exercise, exercises }) {
    if (trainingSession.sharedSession) {
      await trainingSession.finishSharedSession(trainingSession.sharedSession, {
        success: sharedSuccess,
      });
      return { shouldNavigate: true };
    }
    if (!exercise) return { shouldNavigate: false };
    await exercises.finishExercise(exercise, { success: false });
    return { shouldNavigate: true };
  },
};
