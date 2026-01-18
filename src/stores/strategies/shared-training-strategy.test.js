import { describe, expect, it, vi } from "vitest";

import { sharedTrainingStrategy } from "./shared-training-strategy.js";

describe("sharedTrainingStrategy.getActiveUid", () => {
  it("uses shared session active uid when available", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { activeUid: "partner" } };

    expect(
      sharedTrainingStrategy.getActiveUid({ auth, trainingSession })
    ).toBe("partner");
  });

  it("falls back to auth user uid without shared session", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: null };

    expect(
      sharedTrainingStrategy.getActiveUid({ auth, trainingSession })
    ).toBe("self");
  });

  it("returns undefined when neither value is available", () => {
    const auth = { user: null };
    const trainingSession = { sharedSession: null };

    expect(
      sharedTrainingStrategy.getActiveUid({ auth, trainingSession })
    ).toBeUndefined();
  });
});

describe("sharedTrainingStrategy.getActiveExercise", () => {
  it("returns the local exercise when not in shared session", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: null };
    const exercise = { id: "e1" };
    const partnerExercise = { id: "e2" };

    expect(
      sharedTrainingStrategy.getActiveExercise({
        auth,
        trainingSession,
        exercise,
        partnerExercise,
      })
    ).toBe(exercise);
  });

  it("returns the local exercise when active uid matches user", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { activeUid: "self" } };
    const exercise = { id: "e1" };
    const partnerExercise = { id: "e2" };

    expect(
      sharedTrainingStrategy.getActiveExercise({
        auth,
        trainingSession,
        exercise,
        partnerExercise,
      })
    ).toBe(exercise);
  });

  it("returns the partner exercise when active uid is different", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { activeUid: "partner" } };
    const exercise = { id: "e1" };
    const partnerExercise = { id: "e2" };

    expect(
      sharedTrainingStrategy.getActiveExercise({
        auth,
        trainingSession,
        exercise,
        partnerExercise,
      })
    ).toBe(partnerExercise);
  });

  it("prefers the activeUid argument when provided", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { activeUid: "partner" } };
    const exercise = { id: "e1" };
    const partnerExercise = { id: "e2" };

    expect(
      sharedTrainingStrategy.getActiveExercise({
        auth,
        trainingSession,
        exercise,
        partnerExercise,
        activeUid: "self",
      })
    ).toBe(exercise);
  });
});

describe("sharedTrainingStrategy.getActiveTarget", () => {
  it("returns the auth user and exercise when not shared", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: null };
    const exercise = { id: "e1" };

    expect(
      sharedTrainingStrategy.getActiveTarget({ auth, trainingSession, exercise })
    ).toEqual({ userId: "self", exerciseId: "e1" });
  });

  it("uses the active participant exercise id from the session", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = {
      sharedSession: {
        activeUid: "partner",
        participants: {
          partner: { exerciseId: "e2" },
        },
      },
    };

    expect(
      sharedTrainingStrategy.getActiveTarget({ auth, trainingSession, exercise: null })
    ).toEqual({ userId: "partner", exerciseId: "e2" });
  });

  it("prefers the activeUid argument when provided", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = {
      sharedSession: {
        activeUid: "partner",
        participants: {
          self: { exerciseId: "e1" },
        },
      },
    };

    expect(
      sharedTrainingStrategy.getActiveTarget({
        auth,
        trainingSession,
        exercise: null,
        activeUid: "self",
      })
    ).toEqual({ userId: "self", exerciseId: "e1" });
  });
});

describe("sharedTrainingStrategy.getTimerSourceExercise", () => {
  it("returns the local exercise when not shared", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: null };
    const exercise = { id: "e1" };
    const partnerExercise = { id: "e2" };

    expect(
      sharedTrainingStrategy.getTimerSourceExercise({
        auth,
        trainingSession,
        exercise,
        partnerExercise,
      })
    ).toBe(exercise);
  });

  it("returns local exercise when user is primary", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { primaryUid: "self" } };
    const exercise = { id: "e1" };
    const partnerExercise = { id: "e2" };

    expect(
      sharedTrainingStrategy.getTimerSourceExercise({
        auth,
        trainingSession,
        exercise,
        partnerExercise,
      })
    ).toBe(exercise);
  });

  it("returns partner exercise when user is not primary", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { primaryUid: "partner" } };
    const exercise = { id: "e1" };
    const partnerExercise = { id: "e2" };

    expect(
      sharedTrainingStrategy.getTimerSourceExercise({
        auth,
        trainingSession,
        exercise,
        partnerExercise,
      })
    ).toBe(partnerExercise);
  });
});

describe("sharedTrainingStrategy.getActiveParticipantLabel", () => {
  it("returns empty string when not shared", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: null };

    expect(
      sharedTrainingStrategy.getActiveParticipantLabel({
        auth,
        trainingSession,
        activeUid: "self",
        partnerProfile: null,
      })
    ).toBe("");
  });

  it('returns "You" when user is active', () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { activeUid: "self" } };

    expect(
      sharedTrainingStrategy.getActiveParticipantLabel({
        auth,
        trainingSession,
        activeUid: "self",
        partnerProfile: { displayName: "Partner" },
      })
    ).toBe("You");
  });

  it("uses partner display name when available", () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { activeUid: "partner" } };

    expect(
      sharedTrainingStrategy.getActiveParticipantLabel({
        auth,
        trainingSession,
        activeUid: "partner",
        partnerProfile: { displayName: "Taylor" },
      })
    ).toBe("Taylor");
  });

  it('falls back to "Partner" when name missing', () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: { activeUid: "partner" } };

    expect(
      sharedTrainingStrategy.getActiveParticipantLabel({
        auth,
        trainingSession,
        activeUid: "partner",
        partnerProfile: {},
      })
    ).toBe("Partner");
  });
});

describe("sharedTrainingStrategy.completeSet", () => {
  it("returns defaults when missing exercise or session", async () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: null };

    await expect(
      sharedTrainingStrategy.completeSet({
        auth,
        trainingSession,
        exercise: null,
        restTimerMs: 0,
      })
    ).resolves.toEqual({
      finished: false,
      shouldNavigate: false,
      shouldScheduleRest: false,
    });
  });

  it("finishes solo exercise when last set is done", async () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: null };
    const exercises = { finishExercise: vi.fn().mockResolvedValue(undefined) };

    await expect(
      sharedTrainingStrategy.completeSet({
        auth,
        trainingSession,
        exercises,
        exercise: {
          id: "e1",
          warmupEnabled: false,
          setsDone: 0,
          setsTarget: 1,
          warmupSetIndex: 0,
          currentWeight: 100,
        },
        restTimerMs: 90000,
      })
    ).resolves.toEqual({
      finished: true,
      shouldNavigate: true,
      shouldScheduleRest: false,
    });

    expect(exercises.finishExercise).toHaveBeenCalledWith(
      expect.objectContaining({ id: "e1" }),
      { success: true }
    );
  });

  it("updates solo exercise and schedules rest when not finished", async () => {
    const auth = { user: { uid: "self" } };
    const trainingSession = { sharedSession: null };
    const exercises = { updateExercise: vi.fn().mockResolvedValue(undefined) };
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);

    await expect(
      sharedTrainingStrategy.completeSet({
        auth,
        trainingSession,
        exercises,
        exercise: {
          id: "e1",
          warmupEnabled: true,
          warmupSetIndex: 0,
          currentWeight: 100,
          setsDone: 0,
          setsTarget: 5,
        },
        restTimerMs: 90000,
      })
    ).resolves.toEqual({
      finished: false,
      shouldNavigate: false,
      shouldScheduleRest: true,
    });

    expect(exercises.updateExercise).toHaveBeenCalledWith("e1", {
      warmupSetIndex: 1,
      timerEndsAt: 91000,
    });

    nowSpy.mockRestore();
  });

  it("returns navigate true when both partners finish", async () => {
    const auth = { user: { uid: "self" } };
    const session = { id: "session", primaryUid: "self" };
    const trainingSession = {
      sharedSession: session,
      completeSharedSet: vi.fn().mockResolvedValue({
        finished: true,
        shouldFinishSession: true,
      }),
    };

    await expect(
      sharedTrainingStrategy.completeSet({
        auth,
        trainingSession,
        exercise: { id: "e1" },
        restTimerMs: 90000,
      })
    ).resolves.toEqual({
      finished: true,
      shouldNavigate: true,
      shouldScheduleRest: false,
    });
  });

  it("schedules rest only for primary when session continues", async () => {
    const auth = { user: { uid: "self" } };
    const session = { id: "session", primaryUid: "self" };
    const trainingSession = {
      sharedSession: session,
      completeSharedSet: vi.fn().mockResolvedValue({
        finished: false,
        shouldFinishSession: false,
      }),
    };

    await expect(
      sharedTrainingStrategy.completeSet({
        auth,
        trainingSession,
        exercise: { id: "e1" },
        restTimerMs: 90000,
      })
    ).resolves.toEqual({
      finished: false,
      shouldNavigate: false,
      shouldScheduleRest: true,
    });
  });

  it("does not schedule rest when user is not primary", async () => {
    const auth = { user: { uid: "self" } };
    const session = { id: "session", primaryUid: "partner" };
    const trainingSession = {
      sharedSession: session,
      completeSharedSet: vi.fn().mockResolvedValue({
        finished: false,
        shouldFinishSession: false,
      }),
    };

    await expect(
      sharedTrainingStrategy.completeSet({
        auth,
        trainingSession,
        exercise: { id: "e1" },
        restTimerMs: 90000,
      })
    ).resolves.toEqual({
      finished: false,
      shouldNavigate: false,
      shouldScheduleRest: false,
    });
  });
});

describe("sharedTrainingStrategy.toggleWarmup", () => {
  it("no-ops when target is incomplete", async () => {
    const exercises = { updateExerciseByUser: vi.fn() };

    await sharedTrainingStrategy.toggleWarmup({
      activeExercise: { warmupEnabled: true },
      exercises,
      target: { userId: null, exerciseId: null },
    });

    expect(exercises.updateExerciseByUser).not.toHaveBeenCalled();
  });

  it("toggles warmup and resets warmup set index", async () => {
    const exercises = { updateExerciseByUser: vi.fn() };

    await sharedTrainingStrategy.toggleWarmup({
      activeExercise: { warmupEnabled: true },
      exercises,
      target: { userId: "self", exerciseId: "e1" },
    });

    expect(exercises.updateExerciseByUser).toHaveBeenCalledWith("self", "e1", {
      warmupEnabled: false,
      warmupSetIndex: 0,
    });
  });
});

describe("sharedTrainingStrategy.finishExercise", () => {
  it("finishes solo exercise and navigates", async () => {
    const trainingSession = { sharedSession: null };
    const exercises = { finishExercise: vi.fn().mockResolvedValue(undefined) };

    await expect(
      sharedTrainingStrategy.finishExercise({
        trainingSession,
        exercise: { id: "e1" },
        exercises,
        sharedSuccess: false,
      })
    ).resolves.toEqual({ shouldNavigate: true });

    expect(exercises.finishExercise).toHaveBeenCalledWith({ id: "e1" }, { success: false });
  });

  it("finishes shared session and navigates", async () => {
    const session = { id: "session" };
    const trainingSession = {
      sharedSession: session,
      finishSharedSession: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      sharedTrainingStrategy.finishExercise({
        trainingSession,
        sharedSuccess: true,
      })
    ).resolves.toEqual({ shouldNavigate: true });

    expect(trainingSession.finishSharedSession).toHaveBeenCalledWith(session, {
      success: true,
    });
  });
});
