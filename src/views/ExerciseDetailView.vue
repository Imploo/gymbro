<template>
  <div v-if="exercise" class="column">
    <WeightControl
      :exercise-name="exercise.name"
      :display-weight="displayWeight"
      :active-participant-label="activeParticipantLabel"
      :active-exercise="activeExercise"
      :plate-stack="plateStack"
      :plate-style="plateStyle"
      :bar-weight="effectiveBarWeight"
      @adjust="adjustWeight"
      @edit-bar="openBarWeightModal"
    />

    <SessionPartners @add-partner="openPartnerModal" />

    <SetTracker
      :display-sets-done="displaySetsDone"
      :display-sets-target="displaySetsTarget"
      :active-exercise="activeExercise"
      :warmup-weight="warmupWeight"
      :warmup-set-label="warmupSetLabel"
      :is-warmup-enabled="isWarmupEnabled"
      :timer-remaining="timerRemaining"
      @complete-set="completeSet"
      @toggle-warmup="toggleWarmup"
    />

    <div class="card column">
      <button class="button danger" @click="finishExercise">Finish exercise</button>
    </div>

    <ExerciseHistory :history-entries="historyEntries" @remove="removeExercise" />

    <PartnerModal
      v-if="showPartnerModal"
      :exercise="exercise"
      @close="closePartnerModal"
    />

    <BarWeightModal
      v-if="showBarWeightModal"
      v-model="barWeightInput"
      :placeholder="barWeightPlaceholder"
      :is-override="isBarWeightOverride"
      :is-dirty="barWeightDirty"
      :default-label="defaultBarWeightLabel"
      @close="closeBarWeightModal"
      @save="saveBarWeight"
      @reset="resetBarWeight"
    />
  </div>
  <div v-else class="card">Loading...</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useExercisesStore } from "../stores/exercises";
import { useAuthStore } from "../stores/auth";
import { useSocialStore } from "../stores/social";
import { useSharedSessionStore } from "../stores/shared-session";
import { usePartnerExerciseStore } from "../stores/partner-exercise";
import { calculatePlates, getWarmupWeight } from "../utils/plateCalculator";
import { getPlateColors } from "../utils/plateColors";
import { scheduleRestNotification, cancelRestNotification } from "../utils/notifications.js";
import SessionPartners from "../components/SessionPartners.vue";
import PartnerModal from "../components/PartnerModal.vue";
import WeightControl from "../components/exercise-detail/WeightControl.vue";
import BarWeightModal from "../components/exercise-detail/BarWeightModal.vue";
import SetTracker from "../components/exercise-detail/SetTracker.vue";
import ExerciseHistory from "../components/exercise-detail/ExerciseHistory.vue";
import { sessionWorkoutStrategy } from "../stores/strategies/session-workout-strategy";
import { usePartnerProfile } from "../composables/usePartnerProfile";
import { useDisplaySets } from "../composables/useDisplaySets";

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
});

const router = useRouter();
const exercises = useExercisesStore();
const auth = useAuthStore();
const social = useSocialStore();
const sharedSessionStore = useSharedSessionStore();
const partnerExerciseStore = usePartnerExerciseStore();

const timerRemaining = ref(0);
let timerInterval;
const showPartnerModal = ref(false);
const showBarWeightModal = ref(false);

const exercise = computed(() =>
  exercises.userExercises.find((item) => item.id === props.id)
);

const workoutStrategy = sessionWorkoutStrategy;
const sharedSession = computed(() => sharedSessionStore.sharedSession);
const currentUid = computed(() => auth.user?.uid);
const activeUid = computed(() =>
  workoutStrategy.getActiveUid({ auth, sharedSession: sharedSession.value })
);
const partnerExercise = computed(() => partnerExerciseStore.partnerExercise);

const activeExercise = computed(() =>
  workoutStrategy.getActiveExercise({
    auth,
    sharedSession: sharedSession.value,
    exercise: exercise.value,
    partnerExercise: partnerExercise.value,
    activeUid: activeUid.value,
  })
);

const partnerProfile = usePartnerProfile(sharedSession, currentUid);

const warmupWeight = computed(() => {
  if (!activeExercise.value) return 0;
  return getWarmupWeight(
    activeExercise.value.currentWeight,
    activeExercise.value.warmupSetIndex
  );
});

const { displaySetsDone: displaySetsDoneFor, displaySetsTarget: displaySetsTargetFor } =
  useDisplaySets();
const displaySetsDone = computed(() => displaySetsDoneFor(activeExercise.value));
const displaySetsTarget = computed(() => displaySetsTargetFor(activeExercise.value));
const warmupSetLabel = computed(() => (activeExercise.value?.warmupSetIndex ?? 0) + 1);
const isWarmupEnabled = computed(() => Boolean(activeExercise.value?.warmupEnabled));

const preferences = computed(() => auth.preferences);
const barWeightInput = ref("");
const historyEntries = computed(() => {
  if (!exercise.value?.history) return [];
  return [...exercise.value.history]
    .filter((entry) => entry && typeof entry.at === "number")
    .sort((a, b) => b.at - a.at)
    .map((entry) => ({
      key: `${entry.at}-${entry.weight}-${entry.success}`,
      dateLabel: new Date(entry.at).toLocaleDateString(),
      weight: entry.weight ?? "-",
      success: Boolean(entry.success),
      partnerLabel: entry.partner?.displayName ?? "",
    }));
});
const restTimerMs = computed(() => {
  const restSeconds = Number(
    sharedSessionStore.sharedSession?.restTimerSeconds ?? preferences.value.restTimerSeconds
  );
  if (!Number.isFinite(restSeconds)) return 90_000;
  return Math.max(0, restSeconds) * 1000;
});

const normalizeBarWeight = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return parsed;
};

const defaultBarWeight = computed(
  () => normalizeBarWeight(preferences.value.barWeight) ?? 0
);
const defaultBarWeightLabel = computed(() => `${defaultBarWeight.value} kg`);
const barWeightPlaceholder = computed(() => `${defaultBarWeight.value}`);
const barWeightOwner = computed(() => activeExercise.value ?? exercise.value);
const effectiveBarWeight = computed(() => {
  const custom = normalizeBarWeight(barWeightOwner.value?.barWeight);
  return custom ?? defaultBarWeight.value;
});
const isBarWeightOverride = computed(
  () => normalizeBarWeight(barWeightOwner.value?.barWeight) !== null
);

const parseBarWeightInput = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return normalizeBarWeight(trimmed);
};

const barWeightDirty = computed(() => {
  const current = normalizeBarWeight(barWeightOwner.value?.barWeight);
  const next = parseBarWeightInput(barWeightInput.value);
  return current !== next;
});

const restTimerOwnerExercise = computed(() =>
  workoutStrategy.getRestTimerOwnerExercise({
    auth,
    sharedSession: sharedSession.value,
    exercise: exercise.value,
    partnerExercise: partnerExercise.value,
  })
);

const displayWeight = computed(() => {
  if (!activeExercise.value) return 0;
  return activeExercise.value.warmupEnabled
    ? warmupWeight.value
    : activeExercise.value.currentWeight;
});

const plateBreakdown = computed(() => {
  if (!exercise.value) return { plates: [], remaining: 0 };
  return calculatePlates(
    displayWeight.value,
    effectiveBarWeight.value,
    preferences.value.plateConfig
  );
});

const plateStack = computed(() => {
  const stack = [];
  plateBreakdown.value.plates.forEach(({ plate, count }) => {
    for (let i = 0; i < count; i += 1) {
      stack.push(plate);
    }
  });
  return stack;
});

const activeParticipantLabel = computed(() =>
  workoutStrategy.getActiveParticipantLabel({
    auth,
    sharedSession: sharedSession.value,
    activeUid: activeUid.value,
    partnerProfile: partnerProfile.value,
  })
);

const sharedSuccess = computed(() => {
  if (!sharedSessionStore.sharedSession) return false;
  const own = exercise.value;
  const partner = partnerExercise.value;
  if (!own || !partner) return false;
  return [own, partner].every(
    (item) => !item.warmupEnabled && item.setsDone >= item.setsTarget
  );
});

const plateColors = computed(() => getPlateColors(preferences.value));
const plateColor = (plate) => plateColors.value[plate] ?? "#8a6f4a";
const plateTextColor = (plate) => (plate === 2.5 ? "#f5f5f2" : "rgba(0, 0, 0, 0.75)");

const plateStyle = (plate) => {
  const size = 32;
  const height = Math.min(92, Math.max(28, 26 + plate * 2.6));
  return {
    "--plate-color": plateColor(plate),
    "--plate-text-color": plateTextColor(plate),
    "--plate-width": `${size}px`,
    "--plate-height": `${height}px`,
  };
};

const activeTarget = computed(() =>
  workoutStrategy.getActiveTarget({
    auth,
    sharedSession: sharedSession.value,
    exercise: exercise.value,
    activeUid: activeUid.value,
  })
);

const adjustWeight = async (delta) => {
  if (!activeExercise.value) return;
  const { userId, exerciseId } = activeTarget.value ?? {};
  if (!userId || !exerciseId) return;
  const next = Math.max(
    activeExercise.value.currentWeight + delta,
    effectiveBarWeight.value
  );
  await exercises.updateExerciseByUser(userId, exerciseId, { currentWeight: next });
};

const saveBarWeight = async () => {
  if (!barWeightDirty.value) return;
  const next = parseBarWeightInput(barWeightInput.value);
  const { userId, exerciseId } = activeTarget.value ?? {};
  if (!userId || !exerciseId) return;
  await exercises.updateExerciseByUser(userId, exerciseId, { barWeight: next });
};

const resetBarWeight = async () => {
  const { userId, exerciseId } = activeTarget.value ?? {};
  if (!userId || !exerciseId) return;
  await exercises.updateExerciseByUser(userId, exerciseId, { barWeight: null });
};

const openBarWeightModal = () => {
  showBarWeightModal.value = true;
};

const closeBarWeightModal = () => {
  showBarWeightModal.value = false;
};

const completeSet = async () => {
  if (!exercise.value) return;
  const result = await workoutStrategy.completeSet({
    auth,
    sharedSessionStore,
    exercises,
    exercise: exercise.value,
    restTimerMs: restTimerMs.value,
  });
  if (result.shouldScheduleRest) {
    scheduleRestNotification(restTimerMs.value);
  }
  if (result.shouldNavigate) {
    router.push("/exercises");
  }
};

const toggleWarmup = async () => {
  if (!activeExercise.value) return;
  await workoutStrategy.toggleWarmup({
    activeExercise: activeExercise.value,
    exercises,
    target: activeTarget.value,
  });
};

const finishExercise = async () => {
  if (!exercise.value) return;
  const result = await workoutStrategy.finishExercise({
    sharedSessionStore,
    exercises,
    exercise: exercise.value,
    sharedSuccess: sharedSuccess.value,
  });
  if (result.shouldNavigate) {
    router.push("/exercises");
  }
};

const removeExercise = async () => {
  if (!exercise.value) return;
  if (sharedSessionStore.sharedSession?.status === "active") {
    window.alert("Finish the shared session before removing this exercise.");
    return;
  }
  const confirmed = window.confirm(
    `Remove "${exercise.value.name}" from your database? This cannot be undone.`
  );
  if (!confirmed) return;
  await exercises.deleteUserExercise(exercise.value.id);
  router.push("/exercises");
};

const updateTimerRemaining = () => {
  if (!restTimerOwnerExercise.value?.timerEndsAt) {
    timerRemaining.value = 0;
    return;
  }
  const remaining = restTimerOwnerExercise.value.timerEndsAt - Date.now();
  timerRemaining.value = Math.max(0, remaining);
  if (remaining <= 0) {
    if (sharedSessionStore.sharedSession?.primaryUid === auth.user?.uid) {
      exercises.updateExercise(exercise.value.id, { timerEndsAt: null });
    }
  }
};

const openPartnerModal = () => {
  showPartnerModal.value = true;
  social.loadFriendships();
};

const closePartnerModal = () => {
  showPartnerModal.value = false;
  social.userSearchResults = [];
};

onMounted(() => {
  exercises.subscribeUserExercises();
  social.loadFriendships();
  if (exercise.value?.sharedSessionId) {
    sharedSessionStore.subscribeSharedSession(exercise.value.sharedSessionId);
  }
  updateTimerRemaining();
  timerInterval = setInterval(updateTimerRemaining, 1000);
});

onUnmounted(() => {
  cancelRestNotification();
  clearInterval(timerInterval);
  partnerExerciseStore.unsubscribePartnerExercise?.();
  sharedSessionStore.unsubscribeSharedSession?.();
});

watch(
  () => exercise.value?.sharedSessionId,
  (sessionId) => {
    if (!sessionId) {
      sharedSessionStore.unsubscribeSharedSession?.();
      sharedSessionStore.sharedSession = null;
      sharedSessionStore.sharedSessionId = null;
      return;
    }
    sharedSessionStore.subscribeSharedSession(sessionId);
  }
);

watch(
  () => [sharedSessionStore.sharedSession?.id, exercise.value?.id],
  ([sessionId, exerciseId]) => {
    if (!sessionId || !exerciseId) return;
    const entry = sharedSessionStore.sharedSession?.participants?.[auth.user?.uid];
    if (!entry?.exerciseId) {
      sharedSessionStore.joinSharedSession(sessionId, exercise.value);
    }
  }
);

watch(
  () => barWeightOwner.value?.barWeight,
  (value) => {
    const normalized = normalizeBarWeight(value);
    barWeightInput.value = normalized === null ? "" : String(normalized);
  },
  { immediate: true }
);

watch(
  () => [
    sharedSessionStore.sharedSession?.id,
    partnerProfile.value?.uid,
    partnerProfile.value?.exerciseId,
  ],
  ([sessionId, partnerUid, partnerExerciseId]) => {
    if (!sessionId || !partnerUid || !partnerExerciseId) {
      partnerExerciseStore.subscribePartnerExercise(null, null);
      return;
    }
    if (sharedSessionStore.sharedSession?.status === "finished") {
      partnerExerciseStore.subscribePartnerExercise(null, null);
      return;
    }
    partnerExerciseStore.subscribePartnerExercise(partnerUid, partnerExerciseId);
  },
  { immediate: true }
);

watch(
  () => [
    sharedSessionStore.sharedSession?.status,
    sharedSessionStore.sharedSession?.id,
    exercise.value?.sharedSessionId,
  ],
  ([status, sharedSessionId, sessionId]) => {
    if (status === "finished") {
      if (sessionId) {
        exercises.updateExercise(exercise.value.id, { sharedSessionId: null });
      }
      if (sharedSessionId) {
        router.push("/exercises");
      }
    }
  }
);
</script>
