<template>
  <div class="card column">
    <div class="row space-between">
      <strong>Sets</strong>
      <span class="badge">{{ displaySetsDone }}/{{ displaySetsTarget }}</span>
    </div>
    <div class="row space-between align-center">
      <button class="button" :disabled="!activeExercise" @click="$emit('complete-set')">
        Complete set
      </button>
      <WarmupControl
        :active-exercise="activeExercise"
        :is-warmup-enabled="isWarmupEnabled"
        @toggle="$emit('toggle-warmup')"
      />
    </div>
    <div class="row space-between align-center">
      <RestTimer :timer-remaining="timerRemaining" />
      <div class="muted">
        <span v-if="isWarmupEnabled">
          Warmup set {{ warmupSetLabel }} weight: {{ warmupWeight }} kg
        </span>
        <span v-else>No warmup</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import WarmupControl from "./WarmupControl.vue";
import RestTimer from "./RestTimer.vue";

defineProps({
  displaySetsDone: {
    type: Number,
    required: true,
  },
  displaySetsTarget: {
    type: Number,
    required: true,
  },
  activeExercise: {
    type: Object,
    default: null,
  },
  warmupWeight: {
    type: Number,
    required: true,
  },
  warmupSetLabel: {
    type: Number,
    required: true,
  },
  isWarmupEnabled: {
    type: Boolean,
    default: false,
  },
  timerRemaining: {
    type: Number,
    required: true,
  },
});

defineEmits(["complete-set", "toggle-warmup"]);
</script>
