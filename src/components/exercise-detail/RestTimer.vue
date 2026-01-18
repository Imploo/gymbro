<template>
  <div v-if="timerRemaining > 0" class="muted">
    Rest timer: {{ Math.ceil(timerRemaining / 1000) }}s
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
