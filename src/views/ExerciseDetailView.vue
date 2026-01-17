<template>
  <div v-if="exercise" class="column">
    <div class="card column">
      <div class="row" style="justify-content: space-between;">
        <h2>{{ exercise.name }}</h2>
        <span class="badge">{{ exercise.currentWeight }} kg</span>
      </div>

      <div class="row" style="justify-content: space-between;">
        <button class="button secondary" @click="adjustWeight(-2.5)">-2.5</button>
        <button class="button" @click="adjustWeight(2.5)">+2.5</button>
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

    <div class="card column">
      <div class="row" style="justify-content: space-between;">
        <strong>Sets</strong>
        <span class="badge">{{ exercise.setsDone }}/{{ exercise.setsTarget }}</span>
      </div>
      <div class="row" style="justify-content: space-between;">
        <button class="button" @click="completeSet">Complete set</button>
        <button :class="['button', exercise.warmupEnabled ? 'danger' : 'secondary']" @click="toggleWarmup">
          Warmup
        </button>
      </div>
      <div v-if="exercise.warmupEnabled" class="muted">
        Warmup set {{ exercise.warmupSetIndex + 1 }} weight:
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
      <strong>History</strong>
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
          <span :class="['status-pill', entry.success ? 'status-success' : 'status-missed']">
            {{ entry.success ? "Success" : "Missed" }}
          </span>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="card">Loading...</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useExercisesStore } from "../stores/exercises";
import { useAuthStore } from "../stores/auth";
import { calculatePlates, getWarmupWeight } from "../utils/plateCalculator";
import { scheduleRestNotification } from "../utils/notifications";

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
});

const router = useRouter();
const exercises = useExercisesStore();
const auth = useAuthStore();
const timerRemaining = ref(0);
let timerInterval;

const exercise = computed(() =>
  exercises.userExercises.find((item) => item.id === props.id)
);

const warmupWeight = computed(() => {
  if (!exercise.value) return 0;
  return getWarmupWeight(exercise.value.currentWeight, exercise.value.warmupSetIndex);
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
    }));
});
const restTimerMs = computed(() => {
  const restSeconds = Number(preferences.value.restTimerSeconds);
  if (!Number.isFinite(restSeconds)) return 90_000;
  return Math.max(0, restSeconds) * 1000;
});

const displayWeight = computed(() => {
  if (!exercise.value) return 0;
  return exercise.value.warmupEnabled ? warmupWeight.value : exercise.value.currentWeight;
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

const adjustWeight = async (delta) => {
  if (!exercise.value) return;
  const next = Math.max(exercise.value.currentWeight + delta, preferences.value.barWeight);
  await exercises.updateExercise(exercise.value.id, { currentWeight: next });
};

const completeSet = async () => {
  if (!exercise.value) return;
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
  if (!exercise.value) return;
  await exercises.toggleWarmup(exercise.value);
};

const finishExercise = async () => {
  if (!exercise.value) return;
  await exercises.finishExercise(exercise.value, { success: false });
  router.push("/exercises");
};

const updateTimerRemaining = () => {
  if (!exercise.value?.timerEndsAt) {
    timerRemaining.value = 0;
    return;
  }
  const remaining = exercise.value.timerEndsAt - Date.now();
  timerRemaining.value = Math.max(0, remaining);
  if (remaining <= 0) {
    exercises.updateExercise(exercise.value.id, { timerEndsAt: null });
  }
};

onMounted(() => {
  exercises.subscribeUserExercises();
  updateTimerRemaining();
  timerInterval = setInterval(updateTimerRemaining, 1000);
});

onUnmounted(() => {
  clearInterval(timerInterval);
});
</script>
