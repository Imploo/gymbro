import { describe, expect, it } from "vitest";

import { calculatePlates, getWarmupWeight } from "./plateCalculator.js";

describe("calculatePlates", () => {
  it("returns expected plates per side", () => {
    const result = calculatePlates(100, 20, [20, 10, 5, 2.5]);

    expect(result).toEqual({
      targetPerSide: 40,
      remaining: 2.5,
      plates: [
        { plate: 20, count: 1 },
        { plate: 10, count: 1 },
        { plate: 5, count: 1 },
        { plate: 2.5, count: 1 },
      ],
    });
  });

  it("uses duplicate entries as extra plates per side", () => {
    const result = calculatePlates(100, 20, [20, 20, 10, 5, 2.5]);

    expect(result).toEqual({
      targetPerSide: 40,
      remaining: 0,
      plates: [{ plate: 20, count: 2 }],
    });
  });

  it("handles mixed plates and exact totals", () => {
    const result = calculatePlates(95, 20, [20, 15, 10, 5, 2.5, 1.25]);

    expect(result).toEqual({
      targetPerSide: 37.5,
      remaining: 0,
      plates: [
        { plate: 20, count: 1 },
        { plate: 15, count: 1 },
        { plate: 2.5, count: 1 },
      ],
    });
  });

  it("returns empty plates when bar exceeds total", () => {
    const result = calculatePlates(50, 60, [20, 10, 5, 2.5]);

    expect(result).toEqual({
      targetPerSide: 0,
      remaining: 0,
      plates: [],
    });
  });
});

describe("getWarmupWeight", () => {
  it("increments from half the current weight", () => {
    expect(getWarmupWeight(100, 0)).toBe(50);
    expect(getWarmupWeight(100, 3)).toBe(80);
  });

  it("caps at the current weight", () => {
    expect(getWarmupWeight(100, 6)).toBe(100);
  });
});
