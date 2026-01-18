export const soloTrainingStrategy = {
  getActiveUid({ auth }) {
    return auth.user?.uid;
  },
  getActiveExercise({ exercise }) {
    return exercise;
  },
  getActiveTarget({ auth, exercise }) {
    return { userId: auth.user?.uid, exerciseId: exercise?.id };
  },
  getTimerSourceExercise({ exercise }) {
    return exercise;
  },
  getActiveParticipantLabel() {
    return "";
  },
  async completeSet({ exercise, exercises, restTimerMs }) {
    if (!exercise) {
      return { finished: false, shouldNavigate: false, shouldScheduleRest: false };
    }
    const finished = await exercises.completeSet(exercise);
    return {
      finished,
      shouldNavigate: finished,
      shouldScheduleRest: !finished && restTimerMs > 0,
    };
  },
  async toggleWarmup({ activeExercise, exercises, target }) {
    if (!activeExercise || !target?.userId || !target?.exerciseId) return;
    const update = {
      warmupEnabled: !activeExercise.warmupEnabled,
      warmupSetIndex: 0,
    };
    await exercises.updateExerciseByUser(target.userId, target.exerciseId, update);
  },
  async finishExercise({ exercise, exercises }) {
    if (!exercise) return { shouldNavigate: false };
    await exercises.finishExercise(exercise, { success: false });
    return { shouldNavigate: true };
  },
};
