export const useDisplaySets = () => {
  const displaySetsDone = (exercise) => {
    const setsDone = exercise?.setsDone ?? 0;
    const setsTarget = exercise?.setsTarget ?? 0;
    if (exercise?.warmupEnabled) {
      return setsDone;
    }
    return Math.min(setsDone + 1, setsTarget);
  };

  const displaySetsTarget = (exercise) => exercise?.setsTarget ?? 0;

  return { displaySetsDone, displaySetsTarget };
};
