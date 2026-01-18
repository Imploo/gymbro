import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useTrainingSessionStore } from "./training-session";

const runTransactionMock = vi.fn();
const docMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  arrayUnion: vi.fn(),
  collection: vi.fn(),
  doc: (...args) => docMock(...args),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  runTransaction: (...args) => runTransactionMock(...args),
  where: vi.fn(),
}));

vi.mock("../firebase", () => ({ db: {} }));

vi.mock("./auth", () => ({
  useAuthStore: () => ({
    user: { uid: "a" },
    preferences: { restTimerSeconds: 90 },
  }),
}));

vi.mock("./exercises", () => ({
  useExercisesStore: () => ({}),
}));

vi.mock("../utils/storeHelpers", () => ({
  isE2E: false,
  normalizeName: (value) => value,
  normalizeNameLower: (value) => value,
  defaultExercise: {},
}));

const buildExercise = (overrides = {}) => ({
  warmupEnabled: false,
  warmupSetIndex: 0,
  setsDone: 1,
  setsTarget: 3,
  currentWeight: 100,
  ...overrides,
});

const createSnap = (data) => ({
  exists: () => Boolean(data),
  data: () => data,
});

describe("trainingSession.completeSharedSet", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    runTransactionMock.mockReset();
    docMock.mockReset();
  });

  it("starts timer when round completes for non-primary", async () => {
    const session = {
      id: "session",
      primaryUid: "a",
      participants: {
        a: { exerciseId: "ex-a" },
        b: { exerciseId: "ex-b" },
      },
    };
    const sessionData = {
      ...session,
      status: "active",
      participantIds: ["a", "b"],
      activeUid: "b",
      roundStartUid: "a",
      restTimerSeconds: 90,
    };
    const exerciseData = buildExercise({ setsDone: 1 });
    const partnerData = buildExercise({ setsDone: 1 });

    docMock.mockImplementation((_db, ...path) => ({ path: path.join("/") }));

    runTransactionMock.mockImplementation(async (_db, callback) => {
      const updates = [];
      const transaction = {
        get: vi.fn((ref) => {
          if (ref.path === "sharedSessions/session") return createSnap(sessionData);
          if (ref.path === "users/b/exercises/ex-b") return createSnap(exerciseData);
          if (ref.path === "users/a/exercises/ex-a") return createSnap(partnerData);
          return createSnap(null);
        }),
        update: vi.fn((ref, data) => {
          updates.push({ path: ref.path, data });
        }),
      };

      await callback(transaction);
      runTransactionMock.updates = updates;
    });

    const store = useTrainingSessionStore();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);

    await store.completeSharedSet(session, { id: "ex-b" });

    const updates = runTransactionMock.updates ?? [];
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "users/a/exercises/ex-a",
          data: { timerEndsAt: 91000 },
        }),
        expect.objectContaining({
          path: "sharedSessions/session",
          data: expect.objectContaining({ roundStartUid: "a", activeUid: "a" }),
        }),
      ])
    );

    nowSpy.mockRestore();
  });

  it("moves roundStartUid when the starter finishes", async () => {
    const session = {
      id: "session",
      primaryUid: "a",
      participants: {
        a: { exerciseId: "ex-a" },
        b: { exerciseId: "ex-b" },
      },
    };
    const sessionData = {
      ...session,
      status: "active",
      participantIds: ["a", "b"],
      activeUid: "a",
      roundStartUid: "a",
      restTimerSeconds: 90,
    };
    const exerciseData = buildExercise({ setsDone: 2 });
    const partnerData = buildExercise({ setsDone: 0 });

    docMock.mockImplementation((_db, ...path) => ({ path: path.join("/") }));

    runTransactionMock.mockImplementation(async (_db, callback) => {
      const updates = [];
      const transaction = {
        get: vi.fn((ref) => {
          if (ref.path === "sharedSessions/session") return createSnap(sessionData);
          if (ref.path === "users/a/exercises/ex-a") return createSnap(exerciseData);
          if (ref.path === "users/b/exercises/ex-b") return createSnap(partnerData);
          return createSnap(null);
        }),
        update: vi.fn((ref, data) => {
          updates.push({ path: ref.path, data });
        }),
      };

      await callback(transaction);
      runTransactionMock.updates = updates;
    });

    const store = useTrainingSessionStore();

    await store.completeSharedSet(session, { id: "ex-a" });

    const updates = runTransactionMock.updates ?? [];
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "sharedSessions/session",
          data: expect.objectContaining({ roundStartUid: "b", activeUid: "b" }),
        }),
      ])
    );
  });
});
