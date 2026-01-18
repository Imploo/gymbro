<template>
  <div class="muted">
    <span v-if="timerRemaining > 0">
      Rest timer: {{ Math.ceil(timerRemaining / 1000) }}s
    </span>
    <span v-else>No rest</span>
  </div>
</template>

<script setup>
defineProps({
  timerRemaining: {
    type: Number,
    required: true,
  },
});
</script>
