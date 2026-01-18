import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useSocialStore } from "./social";

vi.mock("../firebase", () => ({ db: {} }));

vi.mock("./auth", () => ({
  useAuthStore: () => ({
    user: { uid: "self" },
  }),
}));

vi.mock("../utils/storeHelpers", () => ({
  isE2E: true,
  getFriendshipDocId: vi.fn(),
  getProfileSummary: vi.fn(),
  withPersistence: ({ e2e }) => e2e?.(),
}));

describe("social store (e2e no-op)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("clears search results when running in e2e", async () => {
    const store = useSocialStore();
    store.userSearchResults = [{ uid: "u1" }];

    const results = await store.searchUsers("Sam");

    expect(results).toEqual([]);
    expect(store.userSearchResults).toEqual([]);
  });

  it("clears friendships when running in e2e", async () => {
    const store = useSocialStore();
    store.friends = [{ uid: "u2" }];
    store.friendRequests = [{ id: "r1" }];

    await store.loadFriendships();

    expect(store.friends).toEqual([]);
    expect(store.friendRequests).toEqual([]);
  });
});
