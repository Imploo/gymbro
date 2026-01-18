import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

import App from "./App.vue";
import AuthView from "./views/AuthView.vue";
import ExercisesView from "./views/ExercisesView.vue";
import AddExerciseView from "./views/AddExerciseView.vue";
import ExerciseDetailView from "./views/ExerciseDetailView.vue";
import HistoryView from "./views/HistoryView.vue";
import SettingsView from "./views/SettingsView.vue";
import AdminView from "./views/AdminView.vue";

import "./styles.css";
import { useAuthStore } from "./stores/auth";
import { registerServiceWorker } from "./registerServiceWorker";
import { initForegroundNotifications } from "./utils/notifications";

const routes = [
  { path: "/", redirect: "/exercises" },
  { path: "/auth", component: AuthView },
  { path: "/exercises", component: ExercisesView },
  { path: "/exercises/new", component: AddExerciseView },
  { path: "/exercises/:id", component: ExerciseDetailView, props: true },
  { path: "/history", component: HistoryView },
  { path: "/settings", component: SettingsView },
  { path: "/admin", component: AdminView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const pinia = createPinia();

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia);
  if (!auth.initialized) {
    await auth.init();
  }

  if (!auth.user && to.path !== "/auth") {
    return "/auth";
  }
  if (auth.user && to.path === "/auth") {
    return "/exercises";
  }
  return true;
});

const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount("#app");

registerServiceWorker();
initForegroundNotifications();
