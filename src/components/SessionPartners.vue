<template>
  <div class="card column">
    <div class="row space-between align-center">
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
import { useSharedSessionStore } from "../stores/shared-session";
import { usePartnerProfile } from "../composables/usePartnerProfile";

defineEmits(["add-partner"]);

const auth = useAuthStore();
const sharedSessionStore = useSharedSessionStore();

const sharedSession = computed(() => sharedSessionStore.sharedSession);
const currentProfile = computed(() => auth.profile?.profile ?? {});
const partnerProfile = usePartnerProfile(sharedSession, computed(() => auth.user?.uid));
const activeUid = computed(() => sharedSession.value?.activeUid ?? auth.user?.uid);
</script>
