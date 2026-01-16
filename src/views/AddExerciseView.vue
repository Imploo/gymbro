<template>
  <div class="column">
    <RouterLink to="/exercises" class="button secondary">Back to exercises</RouterLink>

    <div class="card column">
      <h3>Add exercise</h3>
      <label class="muted">From global list</label>
      <select class="select" v-model="selectedGlobal">
        <option value="">Select exercise</option>
        <option v-for="global in exercises.globalExercises" :key="global.id" :value="global.name">
          {{ global.name }}
        </option>
      </select>
      <button class="button secondary" :disabled="!selectedGlobal" @click="addFromGlobal">
        Add from list
      </button>

      <label class="muted">Custom exercise</label>
      <input class="input" v-model="customName" placeholder="Exercise name" />
      <button class="button" :disabled="!customName" @click="addCustom">
        Add custom
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useExercisesStore } from "../stores/exercises";

const exercises = useExercisesStore();
const router = useRouter();
const selectedGlobal = ref("");
const customName = ref("");

const addFromGlobal = async () => {
  await exercises.createExerciseFromGlobal(selectedGlobal.value);
  selectedGlobal.value = "";
  router.push("/exercises");
};

const addCustom = async () => {
  await exercises.createCustomExercise(customName.value);
  customName.value = "";
  router.push("/exercises");
};

onMounted(async () => {
  await exercises.loadGlobalExercises();
});
</script>
