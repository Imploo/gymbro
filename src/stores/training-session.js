import { defineStore } from "pinia";
import {
    addDoc,
    arrayUnion,
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    runTransaction,
    where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuthStore } from "./auth";
import { useExercisesStore } from "./exercises";
import {
    isE2E,
    normalizeName,
    normalizeNameLower,
    defaultExercise,
} from "../utils/storeHelpers";
import { GymBro } from "./strategies/gymbro";

export const useTrainingSessionStore = defineStore("trainingSession", {
    state: () => ({
        sharedSession: null,
        sharedSessionId: null,
        unsubscribeSharedSession: null,
        partnerExercise: null,
        unsubscribePartnerExercise: null,
    }),
    actions: {
        subscribePartnerExercise(uid, exerciseId) {
            this.unsubscribePartnerExercise?.();
            if (!uid || !exerciseId) {
                this.partnerExercise = null;
                return;
            }
            if (isE2E) { // Simple mock for E2E if needed, or just skip
                this.partnerExercise = null;
                return;
            }
            const ref = doc(db, "users", uid, "exercises", exerciseId);
            this.unsubscribePartnerExercise = onSnapshot(ref, (snap) => {
                this.partnerExercise = snap.exists() ? { id: snap.id, ...snap.data() } : null;
            });
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
            if (!auth.user || isE2E || !session?.id || !exercise) {
                return { finished: false, shouldFinishSession: false };
            }
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

                const participantIds = sessionData.participantIds ?? [];
                const partnerUid = participantIds.find((id) => id !== activeUid);
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

                const currentBro = new GymBro({
                    uid: activeUid,
                    exerciseData: current,
                    exerciseRef,
                });
                const partnerBro = partnerData
                    ? new GymBro({
                        uid: partnerUid,
                        exerciseData: partnerData,
                        exerciseRef: partnerExerciseRef,
                    })
                    : null;
                if (partnerBro) {
                    currentBro.next = partnerBro;
                    partnerBro.next = currentBro;
                }

                const update = currentBro.performSet();
                if (!update) return;
                currentBro.exerciseData = { ...currentBro.exerciseData, ...update };

                let nextBro = currentBro.advance();
                const activeDone = !currentBro.canDoSet();
                const partnerDone = partnerBro ? !partnerBro.canDoSet() : false;
                shouldFinishSession = activeDone && partnerDone;
                finished = activeDone;

                transaction.update(exerciseRef, update);

                if (restTimerMs > 0 && primaryRef && !shouldFinishSession) {
                    transaction.update(primaryRef, {
                        timerEndsAt: Date.now() + restTimerMs,
                    });
                }

                if (!shouldFinishSession) {
                    if (!nextBro) {
                        nextBro = currentBro;
                    }
                    transaction.update(sessionRef, {
                        activeUid: nextBro.uid,
                        updatedAt: Date.now(),
                        lastSetBy: activeUid,
                        lastSetAt: Date.now(),
                    });
                }
            });

            if (shouldFinishSession) {
                await this.finishSharedSession(session, { success: true });
            }
            return { finished, shouldFinishSession };
        },
        async finishSharedSession(session, { success = false } = {}) {
            const auth = useAuthStore();
            const exercises = useExercisesStore();
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
                        sharedSessionId: null,
                    });
                }

                transaction.update(sessionRef, {
                    status: "finished",
                    updatedAt: Date.now(),
                    [`completedBy.${auth.user.uid}`]: true,
                });
            });

            const participants = session.participantIds ?? [];
            const cleanupUpdates = participants
                .map((participantId) => {
                    const exerciseId = session.participants?.[participantId]?.exerciseId;
                    if (!exerciseId) return null;
                    return exercises.updateExerciseByUser(participantId, exerciseId, {
                        sharedSessionId: null,
                    });
                })
                .filter(Boolean);
            if (cleanupUpdates.length > 0) {
                await Promise.allSettled(cleanupUpdates);
            }
        },
    },
});
