<template>
  <div v-if="exercise" class="column">
    <div class="card column">
      <div class="row" style="justify-content: space-between;">
        <h2>{{ exercise.name }}</h2>
        <div class="row" style="gap: 8px; align-items: center;">
          <span v-if="activeParticipantLabel" class="badge secondary">
            {{ activeParticipantLabel }}
          </span>
          <span class="badge">{{ displayWeight }} kg</span>
        </div>
      </div>

      <div class="row" style="justify-content: space-between;">
        <button class="button secondary" :disabled="!activeExercise" @click="adjustWeight(-2.5)">
          -2.5
        </button>
        <button class="button" :disabled="!activeExercise" @click="adjustWeight(2.5)">
          +2.5
        </button>
      </div>

      <div class="card column">
        <strong>Total weight</strong>
        <div class="barbell-visual">
          <div class="plate-stack reverse">
            <div
              v-for="(plate, index) in plateStack"
              :key="`left-${plate}-${index}`"
              class="plate"
              :style="plateStyle(plate)"
            >
              <span class="plate-label">{{ plate }}</span>
            </div>
          </div>
          <div class="barbell-bar"></div>
          <div class="plate-stack">
            <div
              v-for="(plate, index) in plateStack"
              :key="`right-${plate}-${index}`"
              class="plate"
              :style="plateStyle(plate)"
            >
              <span class="plate-label">{{ plate }}</span>
            </div>
          </div>
        </div>
        <div class="row" style="justify-content: space-between;">
          <span>Bar</span>
          <span>{{ preferences.barWeight }} kg</span>
        </div>
      </div>
    </div>

    <SessionPartners @add-partner="openPartnerModal" />

    <div class="card column">
      <div class="row" style="justify-content: space-between;">
        <strong>Sets</strong>
        <span class="badge">
          {{ activeExercise?.setsDone ?? 0 }}/{{ activeExercise?.setsTarget ?? 0 }}
        </span>
      </div>
      <div class="row" style="justify-content: space-between;">
        <button class="button" :disabled="!activeExercise" @click="completeSet">
          Complete set
        </button>
        <button
          :class="['button', activeExercise?.warmupEnabled ? 'danger' : 'secondary']"
          :disabled="!activeExercise"
          @click="toggleWarmup"
        >
          Warmup
        </button>
      </div>
      <div v-if="activeExercise?.warmupEnabled" class="muted">
        Warmup set {{ (activeExercise?.warmupSetIndex ?? 0) + 1 }} weight:
        {{ warmupWeight }} kg
      </div>
      <div v-if="timerRemaining > 0" class="muted">
        Rest timer: {{ Math.ceil(timerRemaining / 1000) }}s
      </div>
    </div>

    <div class="card column">
      <button class="button danger" @click="finishExercise">Finish exercise</button>
    </div>

    <div class="card column">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <strong>History</strong>
        <button class="link-button danger" @click="removeExercise">
          Remove from database
        </button>
      </div>
      <div v-if="historyEntries.length === 0" class="muted">No history yet.</div>
      <div v-else class="column" style="gap: 8px;">
        <div
          v-for="entry in historyEntries"
          :key="entry.key"
          class="row"
          style="justify-content: space-between;"
        >
          <span>{{ entry.dateLabel }}</span>
          <span>{{ entry.weight }} kg</span>
          <span v-if="entry.partnerLabel" class="muted">with {{ entry.partnerLabel }}</span>
          <span :class="['status-pill', entry.success ? 'status-success' : 'status-missed']">
            {{ entry.success ? "Success" : "Missed" }}
          </span>
        </div>
      </div>
    </div>

    <PartnerModal
      v-if="showPartnerModal"
      :exercise="exercise"
      @close="closePartnerModal"
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
import { useTrainingSessionStore } from "../stores/training-session";
import { calculatePlates, getWarmupWeight } from "../utils/plateCalculator";
import { scheduleRestNotification } from "../utils/notifications";
import SessionPartners from "../components/SessionPartners.vue";
import PartnerModal from "../components/PartnerModal.vue";

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
const trainingSession = useTrainingSessionStore();

const timerRemaining = ref(0);
let timerInterval;
const showPartnerModal = ref(false);

const exercise = computed(() =>
  exercises.userExercises.find((item) => item.id === props.id)
);

const activeUid = computed(() => trainingSession.sharedSession?.activeUid ?? auth.user?.uid);
const partnerExercise = computed(() => trainingSession.partnerExercise);

const activeExercise = computed(() => {
  if (!trainingSession.sharedSession) return exercise.value;
  if (activeUid.value === auth.user?.uid) return exercise.value;
  return partnerExercise.value;
});

const partnerProfile = computed(() => {
  if (!trainingSession.sharedSession?.participants) return null;
  const entries = Object.entries(trainingSession.sharedSession.participants);
  const other = entries.find(([uid]) => uid !== auth.user?.uid);
  if (!other) return null;
  const [uid, data] = other;
  return { uid, ...data };
});

const warmupWeight = computed(() => {
  if (!activeExercise.value) return 0;
  return getWarmupWeight(
    activeExercise.value.currentWeight,
    activeExercise.value.warmupSetIndex
  );
});

const preferences = computed(() => auth.preferences);
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
    trainingSession.sharedSession?.restTimerSeconds ?? preferences.value.restTimerSeconds
  );
  if (!Number.isFinite(restSeconds)) return 90_000;
  return Math.max(0, restSeconds) * 1000;
});

const timerSourceExercise = computed(() => {
  if (!trainingSession.sharedSession) return exercise.value;
  if (trainingSession.sharedSession.primaryUid === auth.user?.uid) return exercise.value;
  return partnerExercise.value;
});

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
    preferences.value.barWeight,
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

const activeParticipantLabel = computed(() => {
  if (!trainingSession.sharedSession) return "";
  if (activeUid.value === auth.user?.uid) return "You";
  return partnerProfile.value?.displayName || "Partner";
});

const sharedSuccess = computed(() => {
  if (!trainingSession.sharedSession) return false;
  const own = exercise.value;
  const partner = partnerExercise.value;
  if (!own || !partner) return false;
  return [own, partner].every(
    (item) => !item.warmupEnabled && item.setsDone >= item.setsTarget
  );
});

const plateColors = {
  20: "#2b64b4",
  15: "#e2c14b",
  10: "#2f8b57",
  5: "#c73b3b",
  2.5: "#1f1f1f",
  1.25: "#f5f5f2",
};

const plateColor = (plate) => plateColors[plate] ?? "#8a6f4a";
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

const getActiveTarget = () => {
  if (!trainingSession.sharedSession) {
    return { userId: auth.user?.uid, exerciseId: exercise.value?.id };
  }
  const userId = activeUid.value;
  const exerciseId = trainingSession.sharedSession.participants?.[userId]?.exerciseId;
  return { userId, exerciseId };
};

const adjustWeight = async (delta) => {
  if (!activeExercise.value) return;
  const { userId, exerciseId } = getActiveTarget();
  if (!userId || !exerciseId) return;
  const next = Math.max(
    activeExercise.value.currentWeight + delta,
    preferences.value.barWeight
  );
  await exercises.updateExerciseByUser(userId, exerciseId, { currentWeight: next });
};

const completeSet = async () => {
  if (!exercise.value) return;
  const currentSession = trainingSession.sharedSession;
  if (currentSession) {
    await trainingSession.completeSharedSet(currentSession, exercise.value);
    if (restTimerMs.value > 0 && currentSession.primaryUid === auth.user?.uid) {
      scheduleRestNotification(restTimerMs.value);
    }
    return;
  }
  const finished = await exercises.completeSet(exercise.value);
  if (finished) {
    router.push("/exercises");
    return;
  }
  if (restTimerMs.value > 0) {
    scheduleRestNotification(restTimerMs.value);
  }
};

const toggleWarmup = async () => {
  if (!activeExercise.value) return;
  const { userId, exerciseId } = getActiveTarget();
  if (!userId || !exerciseId) return;
  const update = {
    warmupEnabled: !activeExercise.value.warmupEnabled,
    warmupSetIndex: 0,
  };
  await exercises.updateExerciseByUser(userId, exerciseId, update);
};

const finishExercise = async () => {
  if (!exercise.value) return;
  if (trainingSession.sharedSession) {
    await trainingSession.finishSharedSession(trainingSession.sharedSession, {
      success: sharedSuccess.value,
    });
    router.push("/exercises");
    return;
  }
  await exercises.finishExercise(exercise.value, { success: false });
  router.push("/exercises");
};

const removeExercise = async () => {
  if (!exercise.value) return;
  if (trainingSession.sharedSession?.status === "active") {
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
  if (!timerSourceExercise.value?.timerEndsAt) {
    timerRemaining.value = 0;
    return;
  }
  const remaining = timerSourceExercise.value.timerEndsAt - Date.now();
  timerRemaining.value = Math.max(0, remaining);
  if (remaining <= 0) {
    if (trainingSession.sharedSession?.primaryUid === auth.user?.uid) {
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
    trainingSession.subscribeSharedSession(exercise.value.sharedSessionId);
  }
  updateTimerRemaining();
  timerInterval = setInterval(updateTimerRemaining, 1000);
});

onUnmounted(() => {
  clearInterval(timerInterval);
  trainingSession.unsubscribePartnerExercise?.();
  trainingSession.unsubscribeSharedSession?.();
});

watch(
  () => exercise.value?.sharedSessionId,
  (sessionId) => {
    if (!sessionId) {
      trainingSession.unsubscribeSharedSession?.();
      trainingSession.sharedSession = null;
      trainingSession.sharedSessionId = null;
      return;
    }
    trainingSession.subscribeSharedSession(sessionId);
  }
);

watch(
  () => [trainingSession.sharedSession?.id, exercise.value?.id],
  ([sessionId, exerciseId]) => {
    if (!sessionId || !exerciseId) return;
    const entry = trainingSession.sharedSession?.participants?.[auth.user?.uid];
    if (!entry?.exerciseId) {
      trainingSession.joinSharedSession(sessionId, exercise.value);
    }
  }
);

watch(
  () => [
    trainingSession.sharedSession?.id,
    partnerProfile.value?.uid,
    partnerProfile.value?.exerciseId,
  ],
  ([sessionId, partnerUid, partnerExerciseId]) => {
    if (!sessionId || !partnerUid || !partnerExerciseId) {
       trainingSession.subscribePartnerExercise(null, null);
       return;
    }
    if (trainingSession.sharedSession?.status === "finished") {
      trainingSession.subscribePartnerExercise(null, null);
      return;
    }
    trainingSession.subscribePartnerExercise(partnerUid, partnerExerciseId);
  },
  { immediate: true }
);

watch(
  () => [trainingSession.sharedSession?.status, exercise.value?.sharedSessionId],
  ([status, sessionId]) => {
    if (status === "finished" && sessionId) {
      exercises.updateExercise(exercise.value.id, { sharedSessionId: null });
      router.push("/exercises");
    }
  }
);
</script>
