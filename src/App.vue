<template>
  <div class="container">
    <header class="row" style="justify-content: space-between; margin-bottom: 16px;">
      <h1 style="margin: 0;">Gymbro 5x5</h1>
      <nav class="row">
        <RouterLink to="/exercises">Exercises</RouterLink>
        <RouterLink to="/settings">Settings</RouterLink>
        <RouterLink v-if="isAdmin" to="/admin">Admin</RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();
const isAdmin = computed(() => auth.isAdmin);
</script>
