<template>
  <div class="container">
    <header class="topbar">
      <RouterLink class="topbar-title" to="/exercises">GymBro</RouterLink>
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
    <div
      v-if="updatePromptOpen"
      class="update-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
    >
      <div class="update-card">
        <h2 id="update-title" class="update-title">Update available</h2>
        <p class="update-text">
          A newer version of Gymbro is ready. Reload now to get the latest
          updates.
        </p>
        <div class="update-actions">
          <button class="button secondary" type="button" @click="dismissUpdate">
            Later
          </button>
          <button class="button" type="button" @click="applyUpdate">
            Reload now
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const isAdmin = computed(() => auth.isAdmin);
const menuOpen = ref(false);
const updatePromptOpen = ref(false);
const updateRegistration = ref(null);

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

const handleServiceWorkerUpdate = (event) => {
  updateRegistration.value = event.detail?.registration || null;
  updatePromptOpen.value = true;
};

const applyUpdate = () => {
  updatePromptOpen.value = false;
  updateRegistration.value?.waiting?.postMessage({ type: "SKIP_WAITING" });
};

const dismissUpdate = () => {
  updatePromptOpen.value = false;
};

onMounted(() => {
  window.addEventListener("sw-update", handleServiceWorkerUpdate);
});

onBeforeUnmount(() => {
  window.removeEventListener("sw-update", handleServiceWorkerUpdate);
});
</script>
