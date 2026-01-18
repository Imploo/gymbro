import { describe, expect, it } from "vitest";

import { GymBro } from "./gymbro";

const buildExercise = ({ warmupEnabled, setsDone, setsTarget }) => ({
  warmupEnabled,
  setsDone,
  setsTarget,
  warmupSetIndex: 0,
  currentWeight: 100,
});

describe("GymBro.advance", () => {
  it("returns next bro when next can do set", () => {
    const currentBro = new GymBro({
      uid: "a",
      exerciseData: buildExercise({ warmupEnabled: false, setsDone: 1, setsTarget: 5 }),
      exerciseRef: null,
    });
    const nextBro = new GymBro({
      uid: "b",
      exerciseData: buildExercise({ warmupEnabled: true, setsDone: 0, setsTarget: 5 }),
      exerciseRef: null,
    });
    currentBro.next = nextBro;

    expect(currentBro.advance()).toBe(nextBro);
  });

  it("returns current bro when next cannot but current can", () => {
    const currentBro = new GymBro({
      uid: "a",
      exerciseData: buildExercise({ warmupEnabled: false, setsDone: 2, setsTarget: 5 }),
      exerciseRef: null,
    });
    const nextBro = new GymBro({
      uid: "b",
      exerciseData: buildExercise({ warmupEnabled: false, setsDone: 5, setsTarget: 5 }),
      exerciseRef: null,
    });
    currentBro.next = nextBro;

    expect(currentBro.advance()).toBe(currentBro);
  });

  it("returns null when neither bro can do a set", () => {
    const currentBro = new GymBro({
      uid: "a",
      exerciseData: buildExercise({ warmupEnabled: false, setsDone: 5, setsTarget: 5 }),
      exerciseRef: null,
    });
    const nextBro = new GymBro({
      uid: "b",
      exerciseData: buildExercise({ warmupEnabled: false, setsDone: 5, setsTarget: 5 }),
      exerciseRef: null,
    });
    currentBro.next = nextBro;

    expect(currentBro.advance()).toBeNull();
  });

  it("returns current bro when solo and can still do sets", () => {
    const currentBro = new GymBro({
      uid: "solo",
      exerciseData: buildExercise({ warmupEnabled: false, setsDone: 1, setsTarget: 5 }),
      exerciseRef: null,
    });

    expect(currentBro.advance()).toBe(currentBro);
  });

  it("returns null when solo and cannot do sets", () => {
    const currentBro = new GymBro({
      uid: "solo",
      exerciseData: buildExercise({ warmupEnabled: false, setsDone: 5, setsTarget: 5 }),
      exerciseRef: null,
    });

    expect(currentBro.advance()).toBeNull();
  });
});
