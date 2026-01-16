export const calculatePlates = (totalWeight, barWeight, plateConfig) => {
  const plates = [];
  const usablePlates = [...plateConfig].sort((a, b) => b - a);
  const targetPerSide = Math.max((totalWeight - barWeight) / 2, 0);

  let remaining = Math.round(targetPerSide * 100) / 100;

  usablePlates.forEach((plate) => {
    const count = Math.floor(remaining / plate);
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
