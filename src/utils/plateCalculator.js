export const calculatePlates = (totalWeight, barWeight, plateConfig) => {
  const plates = [];
  const plateCounts = plateConfig.reduce((counts, plate) => {
    counts[plate] = (counts[plate] ?? 0) + 1;
    return counts;
  }, {});
  const usablePlates = Object.keys(plateCounts)
    .map((plate) => Number(plate))
    .sort((a, b) => b - a);
  const targetPerSide = Math.max((totalWeight - barWeight) / 2, 0);

  let remaining = Math.round(targetPerSide * 100) / 100;

  usablePlates.forEach((plate) => {
    const maxPerSide = plateCounts[plate] ?? 0;
    const count = Math.min(Math.floor(remaining / plate), maxPerSide);
    if (count > 0) {
      plates.push({ plate, count });
      remaining = Math.round((remaining - plate * count) * 100) / 100;
    }
  });

  return {
    targetPerSide,
    remaining,
    plates,
  };
};

export const getWarmupWeight = (currentWeight, warmupSetIndex) => {
  const start = currentWeight / 2;
  const weight = start + warmupSetIndex * 10;
  return Math.min(weight, currentWeight);
};
