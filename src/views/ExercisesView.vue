<template>
  <div class="column">
    <div class="card column">
      <h2>My exercises</h2>
      <div v-if="exercises.userExercises.length === 0" class="muted">
        No exercises yet.
      </div>
      <RouterLink
        v-for="exercise in exercises.userExercises"
        :key="exercise.id"
        :to="`/exercises/${exercise.id}`"
        class="card row exercise-row"
      >
        <div class="column">
          <strong>{{ exercise.name }}</strong>
          <span class="muted">
            {{ exercise.currentWeight }} kg · Sets {{ exercise.setsDone }}/{{ exercise.setsTarget }}
          </span>
        </div>
        <span :class="['button', { secondary: !isExerciseActive(exercise) }]">
          Open
        </span>
      </RouterLink>
    </div>

    <RouterLink to="/exercises/new" class="button">Add new exercise</RouterLink>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useExercisesStore } from "../stores/exercises";

const exercises = useExercisesStore();

const isExerciseActive = (exercise) => Number(exercise.setsDone ?? 0) > 0;

onMounted(async () => {
  exercises.subscribeUserExercises();
});
</script>
