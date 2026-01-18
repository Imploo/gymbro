<template>
  <div class="card column">
    <div class="row space-between align-center">
      <strong>History</strong>
      <button class="link-button danger" @click="$emit('remove')">
        Remove from database
      </button>
    </div>
    <div v-if="historyEntries.length === 0" class="muted">No history yet.</div>
    <div v-else class="column gap-8">
      <div v-for="entry in historyEntries" :key="entry.key" class="row space-between">
        <span>{{ entry.dateLabel }}</span>
        <span>{{ entry.weight }} kg</span>
        <span v-if="entry.partnerLabel" class="muted">with {{ entry.partnerLabel }}</span>
        <span :class="['status-pill', entry.success ? 'status-success' : 'status-missed']">
          {{ entry.success ? "Success" : "Missed" }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  historyEntries: {
    type: Array,
    default: () => [],
  },
});

defineEmits(["remove"]);
</script>
