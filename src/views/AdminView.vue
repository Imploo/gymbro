<template>
  <div class="column">
    <div v-if="!auth.isAdmin" class="card">
      <p class="muted">Admin access required.</p>
    </div>

    <div v-else class="card column">
      <h2>Global exercises</h2>
      <div v-for="exercise in exercises.globalExercises" :key="exercise.id" class="row">
        <span>{{ exercise.name }}</span>
      </div>

      <label class="muted">New global exercise</label>
      <input class="input" v-model="globalName" placeholder="Exercise name" />
      <button class="button" :disabled="!globalName" @click="addGlobal">
        Add global exercise
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { addDoc, collection } from "firebase/firestore";
import { useAuthStore } from "../stores/auth";
import { useExercisesStore } from "../stores/exercises";
import { db } from "../firebase";

const auth = useAuthStore();
const exercises = useExercisesStore();
const globalName = ref("");

const addGlobal = async () => {
  await addDoc(collection(db, "exercises"), { name: globalName.value.trim() });
  globalName.value = "";
  await exercises.loadGlobalExercises();
};

onMounted(async () => {
  await exercises.loadGlobalExercises();
});
</script>
