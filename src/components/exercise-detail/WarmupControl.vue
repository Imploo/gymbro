<template>
  <div class="column">
    <label class="toggle">
      <input
        type="checkbox"
        :checked="isWarmupEnabled"
        :disabled="!activeExercise"
        @change="$emit('toggle')"
      />
      <span class="toggle-control"></span>
      <span class="toggle-label">Warmup</span>
    </label>
  </div>
</template>

<script setup>
const props = defineProps({
  activeExercise: {
    type: Object,
    default: null,
  },
  isWarmupEnabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["toggle"]);
</script>
