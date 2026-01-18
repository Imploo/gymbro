<template>
  <div class="column">
    <div class="card column">
      <h2>Settings</h2>
      <label class="muted">Bar weight (kg)</label>
      <input class="input" type="number" v-model.number="barWeight" />
      <label class="muted">Plates (kg, comma separated)</label>
      <input class="input" v-model="plateConfigInput" data-testid="plate-config-input" />
      <label class="muted">Plate colors (kg:hex, comma separated)</label>
      <input
        class="input"
        v-model="plateColorsInput"
        data-testid="plate-colors-input"
        placeholder="20:#2b64b4, 15:#e2c14b"
      />
      <label class="muted">Rest timer (seconds)</label>
      <input class="input" type="number" min="0" v-model.number="restTimerSeconds" />
      <p class="muted">Set to 0 to disable the rest timer.</p>
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
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const barWeight = ref(auth.preferences.barWeight);
const plateConfigInput = ref(auth.preferences.plateConfig.join(", "));
const plateColorsInput = ref(
  Object.entries(auth.preferences.plateColors ?? {})
    .map(([plate, color]) => `${plate}:${color}`)
    .join(", ")
);
const restTimerSeconds = ref(auth.preferences.restTimerSeconds);

const save = async () => {
  const plates = plateConfigInput.value
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value) && value > 0);
  const plateColors = plateColorsInput.value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const [plateRaw, colorRaw] = entry.split(":");
      const plate = Number(plateRaw?.trim());
      const color = colorRaw?.trim();
      if (!Number.isNaN(plate) && color) {
        acc[plate] = color;
      }
      return acc;
    }, {});
  const restSeconds = Number(restTimerSeconds.value);
  const restTimerValue = Number.isFinite(restSeconds)
    ? Math.max(0, restSeconds)
    : auth.preferences.restTimerSeconds;

  await auth.updatePreferences({
    barWeight: Number(barWeight.value),
    plateConfig: plates,
    plateColors,
    restTimerSeconds: restTimerValue,
  });
};

const enableNotifications = async () => {
  await auth.enableNotifications();
};
</script>
