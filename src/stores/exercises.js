import { defineStore } from "pinia";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuthStore } from "./auth";

const defaultExercise = {
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

const isE2E = import.meta.env.VITE_E2E === "true";
const storageKeys = {
  globalExercises: "gymbro.e2e.globalExercises",
  userExercises: "gymbro.e2e.userExercises",
};

const readStorage = (key, fallback) => {
  if (!isE2E || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  if (!isE2E || typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const seedGlobalExercises = () => [
  { id: "global-bench", name: "Bench Press" },
  { id: "global-deadlift", name: "Deadlift" },
  { id: "global-ohp", name: "Overhead Press" },
  { id: "global-squat", name: "Squat" },
];

const normalizeName = (name) => name.trim();
const normalizeNameLower = (name) => normalizeName(name).toLowerCase();
const buildExerciseId = () =>
  `ex-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const getLastCompletedAt = (exercise) =>
  typeof exercise.lastCompletedAt === "number"
    ? exercise.lastCompletedAt
    : Number.NEGATIVE_INFINITY;
const sortUserExercises = (exercises) =>
  [...exercises].sort((a, b) => {
    const lastA = getLastCompletedAt(a);
    const lastB = getLastCompletedAt(b);
    if (lastA !== lastB) return lastA - lastB;
    return (a.name || "").localeCompare(b.name || "");
  });

const getProfileSummary = (userDoc) => ({
  uid: userDoc?.id ?? "",
  displayName: userDoc?.profile?.displayName ?? "",
  email: userDoc?.profile?.email ?? "",
  photoURL: userDoc?.profile?.photoURL ?? "",
});

const getFriendshipDocId = (uid1, uid2) =>
  uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;

export const useExercisesStore = defineStore("exercises", {
  state: () => ({
    globalExercises: [],
    userExercises: [],
    loading: false,
    unsubscribeUser: null,
    sharedSession: null,
    sharedSessionId: null,
    unsubscribeSharedSession: null,
    friends: [],
    friendRequests: [],
    userSearchResults: [],
  }),
  actions: {
    async loadGlobalExercises() {
      if (isE2E) {
        const stored = readStorage(storageKeys.globalExercises, []);
        const next = stored.length > 0 ? stored : seedGlobalExercises();
        const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name));
        this.globalExercises = sorted;
        writeStorage(storageKeys.globalExercises, sorted);
        return;
      }

      const q = query(collection(db, "exercises"), orderBy("name"));
      const snap = await getDocs(q);
      this.globalExercises = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    },
    subscribeUserExercises() {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const sorted = sortUserExercises(stored);
        this.userExercises = sorted;
        writeStorage(storageKeys.userExercises, sorted);
        return;
      }

      this.unsubscribeUser?.();
      const q = query(
        collection(db, "users", auth.user.uid, "exercises"),
        orderBy("name")
      );
      this.unsubscribeUser = onSnapshot(q, (snap) => {
        const next = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        this.userExercises = sortUserExercises(next);
      });
    },
    async searchUsers(term) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) {
        this.userSearchResults = [];
        return [];
      }
      const trimmed = term.trim();
      if (!trimmed) {
        this.userSearchResults = [];
        return [];
      }

      const usersRef = collection(db, "users");
      const displayQuery = query(
        usersRef,
        orderBy("profile.displayName"),
        where("profile.displayName", ">=", trimmed),
        where("profile.displayName", "<=", `${trimmed}\uf8ff`)
      );
      const emailQuery = query(
        usersRef,
        orderBy("profile.email"),
        where("profile.email", ">=", trimmed),
        where("profile.email", "<=", `${trimmed}\uf8ff`)
      );

      try {
        const [displaySnap, emailSnap] = await Promise.all([
          getDocs(displayQuery),
          getDocs(emailQuery),
        ]);
        const usersMap = new Map();
        displaySnap.docs.forEach((docSnap) => {
          if (docSnap.id === auth.user.uid) return;
          usersMap.set(docSnap.id, getProfileSummary({ id: docSnap.id, ...docSnap.data() }));
        });
        emailSnap.docs.forEach((docSnap) => {
          if (docSnap.id === auth.user.uid) return;
          usersMap.set(docSnap.id, getProfileSummary({ id: docSnap.id, ...docSnap.data() }));
        });

        const results = Array.from(usersMap.values());
        this.userSearchResults = results;
        return results;
      } catch (error) {
        this.userSearchResults = [];
        return [];
      }
    },
    async loadFriendships() {
      const auth = useAuthStore();
      if (!auth.user || isE2E) {
        this.friends = [];
        this.friendRequests = [];
        return;
      }

      const q = query(
        collection(db, "friendships"),
        where("userIds", "array-contains", auth.user.uid)
      );
      const snap = await getDocs(q);
      const all = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      await Promise.all(
        all.map(async (friendship) => {
          const [uid1, uid2] = friendship.userIds || [];
          if (!uid1 || !uid2) return;
          const desiredId = getFriendshipDocId(uid1, uid2);
          if (desiredId === friendship.id) return;
          const desiredRef = doc(db, "friendships", desiredId);
          const desiredSnap = await getDoc(desiredRef);
          if (!desiredSnap.exists()) {
            await setDoc(desiredRef, {
              userIds: [uid1, uid2],
              requestedBy: friendship.requestedBy ?? uid1,
              status: friendship.status ?? "pending",
              createdAt: friendship.createdAt ?? Date.now(),
              acceptedAt: friendship.acceptedAt ?? null,
            });
          }
          await deleteDoc(doc(db, "friendships", friendship.id));
        })
      );
      const accepted = all.filter((item) => item.status === "accepted");
      const pending = all.filter(
        (item) => item.status === "pending" && item.requestedBy !== auth.user.uid
      );

      const friendProfiles = await Promise.all(
        accepted.map(async (friendship) => {
          const otherId = friendship.userIds.find((id) => id !== auth.user.uid);
          if (!otherId) return null;
          const otherSnap = await getDoc(doc(db, "users", otherId));
          if (!otherSnap.exists()) return null;
          return {
            friendshipId: friendship.id,
            ...getProfileSummary({ id: otherSnap.id, ...otherSnap.data() }),
          };
        })
      );

      const requestProfiles = await Promise.all(
        pending.map(async (request) => {
          const requesterId = request.requestedBy;
          if (!requesterId) return null;
          const requesterSnap = await getDoc(doc(db, "users", requesterId));
          if (!requesterSnap.exists()) return null;
          return {
            id: request.id,
            requester: getProfileSummary({
              id: requesterSnap.id,
              ...requesterSnap.data(),
            }),
          };
        })
      );

      this.friends = friendProfiles.filter(Boolean);
      this.friendRequests = requestProfiles.filter(Boolean);
    },
    async sendFriendRequest(partner) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) return;
      const partnerId = partner?.uid;
      if (!partnerId || partnerId === auth.user.uid) return;

      await this.loadFriendships();
      const alreadyFriend = this.friends.some((item) => item.uid === partnerId);
      if (alreadyFriend) return;

      const pendingQuery = query(
        collection(db, "friendships"),
        where("userIds", "array-contains", auth.user.uid)
      );
      const pendingSnap = await getDocs(pendingQuery);
      const hasPending = pendingSnap.docs.some((docSnap) => {
        const data = docSnap.data();
        return data.status === "pending" && (data.userIds || []).includes(partnerId);
      });
      if (hasPending) return;

      const friendshipId = getFriendshipDocId(auth.user.uid, partnerId);
      const ref = doc(db, "friendships", friendshipId);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === "accepted") return;
          if (data.status === "pending") return;
        }
        transaction.set(ref, {
          userIds: [auth.user.uid, partnerId],
          requestedBy: auth.user.uid,
          status: "pending",
          createdAt: Date.now(),
        });
      });
      await this.loadFriendships();
    },
    async acceptFriendRequest(friendshipId) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) return;
      const ref = doc(db, "friendships", friendshipId);
      await updateDoc(ref, { status: "accepted", acceptedAt: Date.now() });
      await this.loadFriendships();
    },
    async declineFriendRequest(friendshipId) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) return;
      const ref = doc(db, "friendships", friendshipId);
      await deleteDoc(ref);
      await this.loadFriendships();
    },
    async unlinkFriend(friendshipId) {
      return this.declineFriendRequest(friendshipId);
    },
    async createSharedSession(exercise, partner) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) return null;
      if (!exercise || !partner?.uid) return null;
      const exerciseName = normalizeName(exercise.name ?? "");
      const exerciseNameLower = normalizeNameLower(exercise.name ?? "");

      const authProfile = auth.profile?.profile ?? {};
      const session = {
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        participantIds: [auth.user.uid, partner.uid],
        primaryUid: auth.user.uid,
        activeUid: auth.user.uid,
        exerciseName,
        restTimerSeconds: Number(auth.preferences.restTimerSeconds) || 0,
        participants: {
          [auth.user.uid]: {
            displayName: authProfile.displayName ?? "",
            email: authProfile.email ?? "",
            photoURL: authProfile.photoURL ?? "",
            exerciseId: exercise.id,
          },
          [partner.uid]: {
            displayName: partner.displayName ?? "",
            email: partner.email ?? "",
            photoURL: partner.photoURL ?? "",
            exerciseId: null,
          },
        },
        completedBy: {},
      };

      const sessionRef = await addDoc(collection(db, "sharedSessions"), session);

      let partnerExerciseRef = null;
      let partnerExerciseId = null;
      let partnerExerciseExists = false;
      try {
        const partnerQuery = query(
          collection(db, "users", partner.uid, "exercises"),
          where("name", "==", exerciseName)
        );
        const partnerSnap = await getDocs(partnerQuery);
        if (!partnerSnap.empty) {
          const docSnap = partnerSnap.docs[0];
          partnerExerciseRef = doc(db, "users", partner.uid, "exercises", docSnap.id);
          partnerExerciseId = docSnap.id;
          partnerExerciseExists = true;
        } else {
          const allSnap = await getDocs(
            collection(db, "users", partner.uid, "exercises")
          );
          const match = allSnap.docs.find((docSnap) => {
            const data = docSnap.data();
            return normalizeNameLower(data.name ?? "") === exerciseNameLower;
          });
          if (match) {
            partnerExerciseRef = doc(db, "users", partner.uid, "exercises", match.id);
            partnerExerciseId = match.id;
            partnerExerciseExists = true;
          }
        }
      } catch (error) {
        partnerExerciseRef = null;
        partnerExerciseId = null;
        partnerExerciseExists = false;
      }

      if (!partnerExerciseRef) {
        partnerExerciseRef = doc(collection(db, "users", partner.uid, "exercises"));
        partnerExerciseId = partnerExerciseRef.id;
      }

      await runTransaction(db, async (transaction) => {
        transaction.update(doc(db, "users", auth.user.uid, "exercises", exercise.id), {
          sharedSessionId: sessionRef.id,
        });

        if (partnerExerciseRef) {
          if (partnerExerciseExists) {
            transaction.update(partnerExerciseRef, {
              sharedSessionId: sessionRef.id,
              setsDone: 0,
              warmupEnabled: true,
              warmupSetIndex: 0,
              timerEndsAt: null,
            });
          } else {
            transaction.set(partnerExerciseRef, {
              name: exerciseName,
              ...defaultExercise,
              warmupEnabled: true,
              sharedSessionId: sessionRef.id,
            });
          }
        }

        transaction.update(sessionRef, {
          updatedAt: Date.now(),
          [`participants.${partner.uid}.exerciseId`]: partnerExerciseId,
        });
      });

      return sessionRef.id;
    },
    subscribeSharedSession(sessionId) {
      if (!sessionId && !this.sharedSessionId) return;
      const id = sessionId ?? this.sharedSessionId;
      this.unsubscribeSharedSession?.();
      if (isE2E) {
        this.sharedSessionId = id;
        this.sharedSession = null;
        return;
      }
      const ref = doc(db, "sharedSessions", id);
      this.unsubscribeSharedSession = onSnapshot(ref, (snap) => {
        this.sharedSessionId = snap.id;
        this.sharedSession = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      });
    },
    async joinSharedSession(sessionId, exercise) {
      const auth = useAuthStore();
      if (!auth.user || isE2E) return;
      if (!sessionId || !exercise) return;
      const sessionRef = doc(db, "sharedSessions", sessionId);
      const exerciseRef = doc(db, "users", auth.user.uid, "exercises", exercise.id);

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const session = sessionSnap.data();
        if (!session.participantIds?.includes(auth.user.uid)) return;

        transaction.update(sessionRef, {
          updatedAt: Date.now(),
          [`participants.${auth.user.uid}.exerciseId`]: exercise.id,
        });
        transaction.update(exerciseRef, { sharedSessionId: sessionId });
      });
    },
    async toggleActiveParticipant(session) {
      const auth = useAuthStore();
      if (!auth.user || isE2E || !session?.id) return;
      const sessionRef = doc(db, "sharedSessions", session.id);

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        if (data.status !== "active") return;
        if (!data.participantIds?.includes(auth.user.uid)) return;
        const [first, second] = data.participantIds;
        const next = data.activeUid === first ? second : first;
        transaction.update(sessionRef, {
          activeUid: next,
          updatedAt: Date.now(),
        });
      });
    },
    async completeSharedSet(session, exercise) {
      const auth = useAuthStore();
      if (!auth.user || isE2E || !session?.id || !exercise) return false;
      const sessionRef = doc(db, "sharedSessions", session.id);
      const primaryExerciseId = session.participants?.[session.primaryUid]?.exerciseId;
      const primaryRef = primaryExerciseId
        ? doc(db, "users", session.primaryUid, "exercises", primaryExerciseId)
        : null;

      let finished = false;
      let shouldFinishSession = false;

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const sessionData = sessionSnap.data();
        const restSeconds = Number(
          sessionData.restTimerSeconds ?? auth.preferences.restTimerSeconds
        );
        const restTimerMs = Number.isFinite(restSeconds)
          ? Math.max(0, restSeconds) * 1000
          : 90_000;
        if (sessionData.status !== "active") return;
        if (!sessionData.participantIds?.includes(auth.user.uid)) return;

        const activeUid = sessionData.activeUid;
        const activeExerciseId = sessionData.participants?.[activeUid]?.exerciseId;
        if (!activeExerciseId) return;
        const exerciseRef = doc(db, "users", activeUid, "exercises", activeExerciseId);

        const partnerUid = sessionData.participantIds.find((id) => id !== activeUid);
        const partnerExerciseId = sessionData.participants?.[partnerUid]?.exerciseId;
        const partnerExerciseRef = partnerExerciseId
          ? doc(db, "users", partnerUid, "exercises", partnerExerciseId)
          : null;

        const exerciseSnap = await transaction.get(exerciseRef);
        if (!exerciseSnap.exists()) return;
        const current = exerciseSnap.data();

        let partnerData = null;
        if (partnerExerciseRef) {
          const partnerSnap = await transaction.get(partnerExerciseRef);
          if (partnerSnap.exists()) {
            partnerData = partnerSnap.data();
          }
        }

        if (!current.warmupEnabled && current.setsDone >= current.setsTarget) return;

        const update = {};
        if (current.warmupEnabled) {
          update.warmupSetIndex = current.warmupSetIndex + 1;
          const warmupWeight = current.currentWeight / 2 + update.warmupSetIndex * 10;
          if (warmupWeight >= current.currentWeight) {
            update.warmupEnabled = false;
          }
        } else {
          const nextSetsDone = current.setsDone + 1;
          update.setsDone = Math.min(nextSetsDone, current.setsTarget);
          if (nextSetsDone >= current.setsTarget) {
            finished = true;
          }
        }

        const nextWarmupEnabled =
          update.warmupEnabled !== undefined ? update.warmupEnabled : current.warmupEnabled;
        const nextSetsDone = update.setsDone ?? current.setsDone;
        const nextSetsTarget = current.setsTarget ?? 0;
        const activeDone = !nextWarmupEnabled && nextSetsDone >= nextSetsTarget;
        const partnerDone = partnerData
          ? !partnerData.warmupEnabled && partnerData.setsDone >= partnerData.setsTarget
          : false;
        shouldFinishSession = activeDone && partnerDone;

        transaction.update(exerciseRef, update);

        if (restTimerMs > 0 && primaryRef && !shouldFinishSession) {
          transaction.update(primaryRef, {
            timerEndsAt: Date.now() + restTimerMs,
          });
        }

        if (!shouldFinishSession) {
          const [first, second] = sessionData.participantIds;
          const otherUid = sessionData.activeUid === first ? second : first;
          const otherExerciseId = sessionData.participants?.[otherUid]?.exerciseId;
          const nextActive = otherExerciseId ? otherUid : sessionData.activeUid;
          transaction.update(sessionRef, {
            activeUid: nextActive,
            updatedAt: Date.now(),
            lastSetBy: activeUid,
            lastSetAt: Date.now(),
          });
        }
      });

      if (shouldFinishSession) {
        await this.finishSharedSession(session, { success: true });
      }
      return finished;
    },
    async finishSharedSession(session, { success = false } = {}) {
      const auth = useAuthStore();
      if (!auth.user || isE2E || !session?.id) return;
      const sessionRef = doc(db, "sharedSessions", session.id);

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        if (data.status !== "active") return;
        if (!data.participantIds?.includes(auth.user.uid)) return;

        const participants = data.participantIds ?? [];
        const exerciseEntries = [];
        for (const participantId of participants) {
          const exerciseId = data.participants?.[participantId]?.exerciseId;
          if (!exerciseId) continue;
          const exerciseRef = doc(db, "users", participantId, "exercises", exerciseId);
          const exerciseSnap = await transaction.get(exerciseRef);
          if (!exerciseSnap.exists()) continue;
          exerciseEntries.push({
            participantId,
            exerciseRef,
            exerciseData: exerciseSnap.data(),
          });
        }

        const now = Date.now();
        for (const entry of exerciseEntries) {
          const partnerId = participants.find((id) => id !== entry.participantId);
          const partnerInfo = data.participants?.[partnerId] ?? {};
          const historyEntry = {
            at: now,
            weight: entry.exerciseData.currentWeight,
            success,
            partner: {
              uid: partnerId ?? "",
              displayName: partnerInfo.displayName ?? "",
              photoURL: partnerInfo.photoURL ?? "",
            },
          };

          transaction.update(entry.exerciseRef, {
            history: arrayUnion(historyEntry),
            currentWeight: entry.exerciseData.currentWeight + 2.5,
            setsDone: 0,
            warmupEnabled: true,
            warmupSetIndex: 0,
            lastCompletedAt: now,
            timerEndsAt: null,
          });
        }

        transaction.update(sessionRef, {
          status: "finished",
          updatedAt: Date.now(),
          [`completedBy.${auth.user.uid}`]: true,
        });
      });

      const ownExerciseId = session.participants?.[auth.user.uid]?.exerciseId;
      if (ownExerciseId) {
        await this.updateExerciseByUser(auth.user.uid, ownExerciseId, {
          sharedSessionId: null,
        });
      }
      this.sharedSession = null;
      this.sharedSessionId = null;
    },
    async createExerciseFromGlobal(name) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      const trimmed = normalizeName(name);
      if (!trimmed) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const next = sortUserExercises([
          ...stored,
          {
            id: buildExerciseId(),
            name: trimmed,
            ...defaultExercise,
            warmupEnabled: true,
          },
        ]);
        this.userExercises = next;
        writeStorage(storageKeys.userExercises, next);
        return;
      }

      await addDoc(collection(db, "users", auth.user.uid, "exercises"), {
        name: trimmed,
        ...defaultExercise,
        warmupEnabled: true,
      });
    },
    async createCustomExercise(name) {
      return this.createExerciseFromGlobal(name);
    },
    async updateExercise(exerciseId, patch) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const next = sortUserExercises(
          stored.map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, ...patch } : exercise
          )
        );
        this.userExercises = next;
        writeStorage(storageKeys.userExercises, next);
        return;
      }

      const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
      await updateDoc(ref, patch);
    },
    async updateExerciseByUser(userId, exerciseId, patch) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (!userId || !exerciseId) return;
      if (isE2E) {
        if (userId !== auth.user?.uid) return;
        await this.updateExercise(exerciseId, patch);
        return;
      }

      const ref = doc(db, "users", userId, "exercises", exerciseId);
      await updateDoc(ref, patch);
    },
    async deleteUserExercise(exerciseId) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (!exerciseId) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const next = sortUserExercises(stored.filter((exercise) => exercise.id !== exerciseId));
        this.userExercises = next;
        writeStorage(storageKeys.userExercises, next);
        return;
      }

      const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
      await deleteDoc(ref);
    },
    async addHistoryEntry(exerciseId, entry) {
      const auth = useAuthStore();
      if (!auth.user && !isE2E) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.userExercises, []);
        const next = sortUserExercises(
          stored.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;
          const history = Array.isArray(exercise.history) ? exercise.history : [];
          return { ...exercise, history: [...history, entry] };
          })
        );
        this.userExercises = next;
        writeStorage(storageKeys.userExercises, next);
        return;
      }

      const ref = doc(db, "users", auth.user.uid, "exercises", exerciseId);
      await updateDoc(ref, { history: arrayUnion(entry) });
    },
    async completeSet(exercise) {
      const auth = useAuthStore();
      const restSeconds = Number(auth.preferences.restTimerSeconds);
      const restTimerMs = Number.isFinite(restSeconds)
        ? Math.max(0, restSeconds) * 1000
        : 90_000;
      const update = {};

      if (exercise.warmupEnabled) {
        update.timerEndsAt = restTimerMs > 0 ? Date.now() + restTimerMs : null;
        const nextWarmup = exercise.warmupSetIndex + 1;
        update.warmupSetIndex = nextWarmup;
        const warmupWeight = exercise.currentWeight / 2 + nextWarmup * 10;
        if (warmupWeight >= exercise.currentWeight) {
          update.warmupEnabled = false;
        }
      } else {
        const nextSetsDone = exercise.setsDone + 1;
        if (nextSetsDone >= exercise.setsTarget) {
          await this.finishExercise(exercise, { addWeight: true, success: true });
          return true;
        }
        update.setsDone = nextSetsDone;
        update.timerEndsAt = restTimerMs > 0 ? Date.now() + restTimerMs : null;
      }

      await this.updateExercise(exercise.id, update);
      return false;
    },
    async finishExercise(exercise, { addWeight = true, success = false } = {}) {
      await this.addHistoryEntry(exercise.id, {
        at: Date.now(),
        weight: exercise.currentWeight,
        success,
      });
      const update = {
        currentWeight: exercise.currentWeight + (addWeight ? 2.5 : 0),
        setsDone: 0,
        warmupEnabled: true,
        warmupSetIndex: 0,
        lastCompletedAt: Date.now(),
      };
      await this.updateExercise(exercise.id, update);
    },
    async toggleWarmup(exercise) {
      const update = {
        warmupEnabled: !exercise.warmupEnabled,
        warmupSetIndex: 0,
      };
      await this.updateExercise(exercise.id, update);
    },
    async addGlobalExercise(name) {
      const trimmed = normalizeName(name);
      if (!trimmed) return;
      if (isE2E) {
        const stored = readStorage(storageKeys.globalExercises, []);
        const exists = stored.some(
          (exercise) => exercise.name.toLowerCase() === trimmed.toLowerCase()
        );
        const next = exists
          ? stored
          : [
              ...stored,
              {
                id: `global-${trimmed.toLowerCase().replace(/\s+/g, "-")}`,
                name: trimmed,
              },
            ];
        const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name));
        this.globalExercises = sorted;
        writeStorage(storageKeys.globalExercises, sorted);
        return;
      }

      await addDoc(collection(db, "exercises"), { name: trimmed });
    },
    async loadAdminExercises() {
      if (isE2E) {
        await this.loadGlobalExercises();
        return;
      }

      const q = query(
        collection(db, "exercises"),
        where("name", "!=", "")
      );
      const snap = await getDocs(q);
      this.globalExercises = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    },
  },
});
