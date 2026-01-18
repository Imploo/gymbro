import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useAuthStore } from "./auth";

const storage = new Map();

vi.mock("../firebase", () => ({
  auth: {},
  db: {},
  googleProvider: {},
}));

vi.mock("../utils/storeHelpers", () => ({
  clearStorage: (keys) => keys.forEach((key) => storage.delete(key)),
  readStorage: (key) => storage.get(key) ?? null,
  writeStorage: (key, value) => storage.set(key, value),
  withPersistence: ({ e2e }) => e2e?.(),
}));

describe("auth store (e2e persistence)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    storage.clear();
  });

  it("hydrates user and profile from storage on init", async () => {
    storage.set("gymbro.e2e.user", { uid: "u1", displayName: "Test" });
    storage.set("gymbro.e2e.profile", {
      profile: { displayName: "Test", email: "t@example.com", photoURL: "" },
      preferences: { barWeight: 25 },
      isAdmin: false,
    });

    const store = useAuthStore();
    await store.init();

    expect(store.user?.uid).toBe("u1");
    expect(store.profile?.preferences?.barWeight).toBe(25);
    expect(store.initialized).toBe(true);
  });

  it("updates preferences and writes to storage", async () => {
    storage.set("gymbro.e2e.user", { uid: "u1" });
    storage.set("gymbro.e2e.profile", {
      profile: { displayName: "Test", email: "t@example.com", photoURL: "" },
      preferences: { barWeight: 20, restTimerSeconds: 90 },
      isAdmin: false,
    });

    const store = useAuthStore();
    await store.init();
    await store.updatePreferences({ restTimerSeconds: 120 });

    expect(store.preferences.restTimerSeconds).toBe(120);
    const storedProfile = storage.get("gymbro.e2e.profile");
    expect(storedProfile.preferences.restTimerSeconds).toBe(120);
  });
});
