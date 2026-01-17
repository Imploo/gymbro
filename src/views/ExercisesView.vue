<template>
  <div class="column">
    <div v-if="social.friendRequests.length" class="card column">
      <strong>Friend requests</strong>
      <div
        v-for="request in social.friendRequests"
        :key="request.id"
        class="row partner-item"
      >
        <span>{{ request.requester.displayName || request.requester.email }}</span>
        <div class="row" style="gap: 8px;">
          <button class="button" @click="social.acceptFriendRequest(request.id)">
            Accept
          </button>
          <button class="button secondary" @click="social.declineFriendRequest(request.id)">
            Decline
          </button>
        </div>
      </div>
    </div>

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
import { useSocialStore } from "../stores/social";

const exercises = useExercisesStore();
const social = useSocialStore();

const isExerciseActive = (exercise) => Number(exercise.setsDone ?? 0) > 0;

onMounted(async () => {
  exercises.subscribeUserExercises();
  social.loadFriendships();
});
</script>
