<template>
  <div class="column gap-8">
    <button
      :class="['button', isWarmupEnabled ? 'danger' : 'secondary']"
      :disabled="!activeExercise"
      @click="$emit('toggle')"
    >
      Warmup
    </button>
    <div v-if="isWarmupEnabled" class="muted">
      Warmup set {{ warmupSetLabel }} weight: {{ warmupWeight }} kg
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
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
});

defineEmits(["toggle"]);
</script>
