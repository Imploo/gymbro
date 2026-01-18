<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal card column">
      <div class="row space-between align-center">
        <strong>Add training partner</strong>
        <button class="button secondary" @click="$emit('close')">Close</button>
      </div>

      <div class="row gap-8 full-width">
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

      <div class="column gap-8">
        <strong>Friends</strong>
        <div v-if="social.friends.length === 0" class="muted">No friends yet.</div>
        <div v-for="friend in social.friends" :key="friend.uid" class="row partner-item">
          <span>{{ friend.displayName || friend.email }}</span>
          <div class="row gap-8">
            <button class="button" @click="startSession(friend)">Add</button>
            <button class="button secondary" @click="social.unlinkFriend(friend.friendshipId)">
              Unlink
            </button>
          </div>
        </div>
      </div>

      <div v-if="social.userSearchResults.length" class="column gap-8">
        <strong>Search results</strong>
        <div v-for="user in social.userSearchResults" :key="user.uid" class="row partner-item">
          <span>{{ user.displayName || user.email }}</span>
          <div class="row gap-8">
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
import { useSharedSessionStore } from "../stores/shared-session";

const props = defineProps({
  exercise: {
    type: Object,
    required: true,
    validator: (value) => Boolean(value?.id && value?.name),
  },
});

const emit = defineEmits(["close"]);

const social = useSocialStore();
const sharedSessionStore = useSharedSessionStore();

const searchTerm = ref("");
const friendIds = computed(() => new Set(social.friends.map((friend) => friend.uid)));
const searchTimer = ref(null);

const search = () => {
  social.searchUsers(searchTerm.value);
};

const startSession = async (friend) => {
  const sessionId = await sharedSessionStore.createSharedSession(props.exercise, friend);
  if (sessionId) {
    sharedSessionStore.subscribeSharedSession(sessionId);
    emit("close");
  }
};

watch(
  () => searchTerm.value,
  (value) => {
    if (searchTimer.value) {
      clearTimeout(searchTimer.value);
    }
    if (!value.trim()) {
      social.userSearchResults = [];
      return;
    }
    searchTimer.value = setTimeout(() => {
      social.searchUsers(value);
    }, 250);
  }
);

onUnmounted(() => {
  if (searchTimer.value) {
    clearTimeout(searchTimer.value);
  }
  social.userSearchResults = []; // Clear results when closed/destroyed
});
</script>
