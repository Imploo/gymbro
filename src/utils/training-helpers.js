export async function toggleWarmupForTarget({
  activeExercise,
  exercises,
  target,
}) {
  if (!activeExercise || !target?.userId || !target?.exerciseId) return;
  const update = {
    warmupEnabled: !activeExercise.warmupEnabled,
    warmupSetIndex: 0,
  };
  await exercises.updateExerciseByUser(target.userId, target.exerciseId, update);
}
