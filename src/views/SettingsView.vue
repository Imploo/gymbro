<template>
  <div class="column">
    <div class="card column">
      <h2>Settings</h2>
      <label class="muted">Bar weight (kg)</label>
      <input class="input" type="number" v-model.number="barWeight" />
      <label class="muted">Plates (kg, comma separated)</label>
      <input class="input" v-model="plateConfigInput" />
      <button class="button" @click="save">Save</button>
    </div>

    <div class="card column">
      <h3>Notifications</h3>
      <p class="muted">
        Enable rest timer notifications on this device.
      </p>
      <button class="button secondary" @click="enableNotifications">
        Enable notifications
      </button>
    </div>

    <div class="card column">
      <h3>Account</h3>
      <button class="button danger" @click="auth.signOut">Sign out</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const barWeight = ref(auth.preferences.barWeight);
const plateConfigInput = ref(auth.preferences.plateConfig.join(", "));

const save = async () => {
  const plates = plateConfigInput.value
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value) && value > 0);

  await auth.updatePreferences({
    barWeight: Number(barWeight.value),
    plateConfig: plates,
  });
};

const enableNotifications = async () => {
  await auth.enableNotifications();
};
</script>
