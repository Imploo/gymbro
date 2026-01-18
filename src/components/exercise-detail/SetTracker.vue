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
        :warmup-weight="warmupWeight"
        :warmup-set-label="warmupSetLabel"
        :is-warmup-enabled="isWarmupEnabled"
        @toggle="$emit('toggle-warmup')"
      />
    </div>
    <RestTimer :timer-remaining="timerRemaining" />
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
