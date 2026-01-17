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
        <div class="row" style="justify-content: space-between;">
          <span>Bar</span>
          <span>{{ preferences.barWeight }} kg</span>
        </div>
        <div v-for="plate in plateBreakdown.plates" :key="plate.plate" class="row" style="justify-content: space-between;">
          <span>{{ plate.plate }} kg plate</span>
          <span>x{{ plate.count }} each side</span>
        </div>
        <div v-if="plateBreakdown.remaining > 0" class="muted">
          Remaining per side: {{ plateBreakdown.remaining.toFixed(2) }} kg
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
        <button class="button secondary" @click="toggleWarmup">
          {{ exercise.warmupEnabled ? "Warmup on" : "Warmup off" }}
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

const preferences = computed(() => auth.preferences);
const restTimerMs = computed(() => {
  const restSeconds = Number(preferences.value.restTimerSeconds);
  if (!Number.isFinite(restSeconds)) return 90_000;
  return Math.max(0, restSeconds) * 1000;
});

const plateBreakdown = computed(() => {
  if (!exercise.value) return { plates: [], remaining: 0 };
  return calculatePlates(
    exercise.value.currentWeight,
    preferences.value.barWeight,
    preferences.value.plateConfig
  );
});

const warmupWeight = computed(() => {
  if (!exercise.value) return 0;
  return getWarmupWeight(exercise.value.currentWeight, exercise.value.warmupSetIndex);
});

const adjustWeight = async (delta) => {
  if (!exercise.value) return;
  const next = Math.max(exercise.value.currentWeight + delta, preferences.value.barWeight);
  await exercises.updateExercise(exercise.value.id, { currentWeight: next });
};

const completeSet = async () => {
  if (!exercise.value) return;
  await exercises.completeSet(exercise.value);
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
  await exercises.finishExercise(exercise.value);
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
