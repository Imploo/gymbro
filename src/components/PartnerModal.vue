<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal card column">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <strong>Add training partner</strong>
        <button class="button secondary" @click="$emit('close')">Close</button>
      </div>

      <div class="row" style="gap: 8px; width: 100%;">
        <input
          v-model="searchTerm"
          class="input"
          placeholder="Search by display name or email"
          @keyup.enter="search"
        />
        <button class="button" @click="search">
          Search
        </button>
      </div>

      <div class="column" style="gap: 8px;">
        <strong>Friends</strong>
        <div v-if="social.friends.length === 0" class="muted">No friends yet.</div>
        <div v-for="friend in social.friends" :key="friend.uid" class="row partner-item">
          <span>{{ friend.displayName || friend.email }}</span>
          <div class="row" style="gap: 8px;">
            <button class="button" @click="startSession(friend)">Add</button>
            <button class="button secondary" @click="social.unlinkFriend(friend.friendshipId)">
              Unlink
            </button>
          </div>
        </div>
      </div>

      <div v-if="social.userSearchResults.length" class="column" style="gap: 8px;">
        <strong>Search results</strong>
        <div v-for="user in social.userSearchResults" :key="user.uid" class="row partner-item">
          <span>{{ user.displayName || user.email }}</span>
          <div class="row" style="gap: 8px;">
            <button
              v-if="friendIds.has(user.uid)"
              class="button"
              @click="startSession(user)"
            >
              Add
            </button>
            <button v-else class="button secondary" @click="social.sendFriendRequest(user)">
              Send request
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from "vue";
import { useSocialStore } from "../stores/social";
import { useTrainingSessionStore } from "../stores/training-session";

const props = defineProps({
  exercise: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const social = useSocialStore();
const trainingSession = useTrainingSessionStore();

const searchTerm = ref("");
const friendIds = computed(() => new Set(social.friends.map((friend) => friend.uid)));
let searchTimer;

const search = () => {
  social.searchUsers(searchTerm.value);
};

const startSession = async (friend) => {
  const sessionId = await trainingSession.createSharedSession(props.exercise, friend);
  if (sessionId) {
    trainingSession.subscribeSharedSession(sessionId);
    emit("close");
  }
};

watch(
  () => searchTerm.value,
  (value) => {
    clearTimeout(searchTimer);
    if (!value.trim()) {
      social.userSearchResults = [];
      return;
    }
    searchTimer = setTimeout(() => {
      social.searchUsers(value);
    }, 250);
  }
);

onUnmounted(() => {
  clearTimeout(searchTimer);
  social.userSearchResults = []; // Clear results when closed/destroyed
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(26, 28, 24, 0.65);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 60;
}

.modal {
  width: min(520px, 100%);
  gap: 12px;
}

.partner-item {
  justify-content: space-between;
  width: 100%;
}
</style>
