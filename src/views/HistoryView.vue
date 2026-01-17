<template>
  <div class="column">
    <div class="card column">
      <h2>History</h2>
      <div v-if="historyEntries.length === 0" class="muted">No history yet.</div>
      <div v-else class="column" style="gap: 8px;">
        <div v-for="entry in historyEntries" :key="entry.key" class="row history-row">
          <div class="column">
            <strong>{{ entry.exerciseName }}</strong>
            <span class="muted">{{ entry.dateLabel }}</span>
            <span v-if="entry.partnerLabel" class="muted">with {{ entry.partnerLabel }}</span>
          </div>
          <span>{{ entry.weight }} kg</span>
          <span :class="['status-pill', entry.success ? 'status-success' : 'status-missed']">
            {{ entry.success ? "Success" : "Missed" }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useExercisesStore } from "../stores/exercises";

const exercises = useExercisesStore();

const historyEntries = computed(() => {
  const entries = exercises.userExercises.flatMap((exercise) => {
    const history = Array.isArray(exercise.history) ? exercise.history : [];
    return history.map((entry) => ({
      key: `${exercise.id}-${entry.at}-${entry.weight}-${entry.success}`,
      exerciseName: exercise.name,
      dateLabel: new Date(entry.at).toLocaleDateString(),
      weight: entry.weight ?? "-",
      success: Boolean(entry.success),
      partnerLabel: entry.partner?.displayName ?? "",
      at: entry.at,
    }));
  });

  return entries
    .filter((entry) => typeof entry.at === "number")
    .sort((a, b) => b.at - a.at);
});

onMounted(() => {
  exercises.subscribeUserExercises();
});
</script>
