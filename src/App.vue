<template>
  <div class="container">
    <header class="topbar">
      <RouterLink class="topbar-title" to="/exercises">Gymbro</RouterLink>
      <div class="menu">
        <button
          class="menu-button"
          type="button"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-haspopup="true"
          @click="toggleMenu"
        >
          <span class="sr-only">Toggle navigation</span>
          <span class="menu-icon" aria-hidden="true"></span>
        </button>
        <nav v-if="menuOpen" class="menu-panel" @click="closeMenu">
          <RouterLink class="menu-link" to="/exercises">Exercises</RouterLink>
          <RouterLink class="menu-link" to="/history">History</RouterLink>
          <RouterLink class="menu-link" to="/settings">Settings</RouterLink>
          <RouterLink v-if="isAdmin" class="menu-link" to="/admin">Admin</RouterLink>
        </nav>
      </div>
    </header>
    <RouterView />
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const isAdmin = computed(() => auth.isAdmin);
const menuOpen = ref(false);

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value;
};

const closeMenu = () => {
  menuOpen.value = false;
};

watch(
  () => auth.user,
  (user) => {
    if (!user && route.path !== "/auth") {
      closeMenu();
      router.replace("/auth");
    }
  }
);
</script>
