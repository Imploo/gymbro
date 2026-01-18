export const defaultExercise = {
    status: "active",
    currentWeight: 20,
    warmupEnabled: true,
    setsTarget: 5,
    setsDone: 0,
    warmupSetIndex: 0,
    lastCompletedAt: null,
    timerEndsAt: null,
    history: [],
};

export const trimName = (name) => name.trim();
export const trimAndLowercase = (name) => trimName(name).toLowerCase();

export const sanitizeName = (name) =>
    trimName(String(name ?? ""))
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ");

export const buildExerciseId = () =>
    `ex-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export const getProfileSummary = (userDoc) => ({
    uid: userDoc?.id ?? "",
    displayName: userDoc?.profile?.displayName ?? "",
    email: userDoc?.profile?.email ?? "",
    photoURL: userDoc?.profile?.photoURL ?? "",
});

export const getFriendshipDocId = (uid1, uid2) =>
    uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;

export const isE2E = import.meta.env.VITE_E2E === "true";

export const storageKeys = {
    globalExercises: "gymbro.e2e.globalExercises",
    userExercises: "gymbro.e2e.userExercises",
};

export const readStorage = (key, fallback) => {
    if (!isE2E || typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
};

export const writeStorage = (key, value) => {
    if (!isE2E || typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
};

export const clearStorage = (keys) => {
    if (!isE2E || typeof window === "undefined") return;
    keys.forEach((key) => window.localStorage.removeItem(key));
};

export const withPersistence = async ({ e2e, remote }) => {
    if (isE2E) {
        return e2e?.();
    }
    return remote?.();
};

export const sortUserExercises = (exercises) =>
    [...exercises].sort((a, b) => {
        const getLastCompletedAt = (exercise) =>
            typeof exercise.lastCompletedAt === "number"
                ? exercise.lastCompletedAt
                : Number.NEGATIVE_INFINITY;
        const lastA = getLastCompletedAt(a);
        const lastB = getLastCompletedAt(b);
        if (lastA !== lastB) return lastA - lastB;
        return (a.name || "").localeCompare(b.name || "");
    });
