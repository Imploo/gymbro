export const DEFAULT_PLATE_COLORS = {
  20: "#2b64b4",
  15: "#e2c14b",
  10: "#2f8b57",
  5: "#c73b3b",
  2.5: "#1f1f1f",
  1.25: "#f5f5f2",
};

export const getPlateColors = (preferences) => ({
  ...DEFAULT_PLATE_COLORS,
  ...(preferences?.plateColors ?? {}),
});
