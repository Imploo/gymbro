<template>
  <div class="card column">
    <div class="row" style="justify-content: space-between; align-items: center;">
      <strong>Training partners</strong>
      <button v-if="!sharedSession" class="button secondary" @click="$emit('add-partner')">
        Add partner
      </button>
    </div>
    <div v-if="sharedSession" class="row partner-row">
      <div :class="['avatar', activeUid === auth.user?.uid ? 'avatar-active' : '']">
        <img v-if="currentProfile.photoURL" :src="currentProfile.photoURL" alt="You" />
        <span v-else>{{ (currentProfile.displayName || "You").slice(0, 1) }}</span>
      </div>
      <div :class="['avatar', activeUid === partnerProfile?.uid ? 'avatar-active' : '']">
        <img
          v-if="partnerProfile?.photoURL"
          :src="partnerProfile.photoURL"
          alt="Partner"
        />
        <span v-else>{{ (partnerProfile?.displayName || "?").slice(0, 1) }}</span>
      </div>
      <div class="column">
        <span class="muted">
          Shared with {{ partnerProfile?.displayName || "partner" }}
        </span>
        <span class="muted" v-if="sharedSession?.primaryUid === auth.user?.uid">
          You control the rest timer
        </span>
      </div>
    </div>
    <div v-else class="muted">Train together by adding a partner.</div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useAuthStore } from "../stores/auth";
import { useTrainingSessionStore } from "../stores/training-session";

defineEmits(["add-partner"]);

const auth = useAuthStore();
const trainingSession = useTrainingSessionStore();

const sharedSession = computed(() => trainingSession.sharedSession);
const currentProfile = computed(() => auth.profile?.profile ?? {});
const partnerProfile = computed(() => {
  if (!sharedSession.value?.participants) return null;
  const entries = Object.entries(sharedSession.value.participants);
  const other = entries.find(([uid]) => uid !== auth.user?.uid);
  if (!other) return null;
  const [uid, data] = other;
  return { uid, ...data };
});
const activeUid = computed(() => sharedSession.value?.activeUid ?? auth.user?.uid);
</script>

<style scoped>
.partner-row {
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: var(--base);
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-weight: 700;
  color: var(--text);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-active {
  border-color: var(--highlight);
  box-shadow: 0 0 0 2px rgba(214, 163, 76, 0.3);
}
</style>
