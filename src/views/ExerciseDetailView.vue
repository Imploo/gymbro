<template>
  <div v-if="exercise" class="column">
    <div class="card column">
      <div class="row" style="justify-content: space-between;">
        <h2>{{ exercise.name }}</h2>
        <div class="row" style="gap: 8px; align-items: center;">
          <span v-if="activeParticipantLabel" class="badge secondary">
            {{ activeParticipantLabel }}
          </span>
          <span class="badge">{{ displayWeight }} kg</span>
        </div>
      </div>

      <div class="row" style="justify-content: space-between;">
        <button class="button secondary" :disabled="!activeExercise" @click="adjustWeight(-2.5)">
          -2.5
        </button>
        <button class="button" :disabled="!activeExercise" @click="adjustWeight(2.5)">
          +2.5
        </button>
      </div>

      <div class="card column">
        <strong>Total weight</strong>
        <div class="barbell-visual">
          <div class="plate-stack reverse">
            <div
              v-for="(plate, index) in plateStack"
              :key="`left-${plate}-${index}`"
              class="plate"
              :style="plateStyle(plate)"
            >
              <span class="plate-label">{{ plate }}</span>
            </div>
          </div>
          <div class="barbell-bar"></div>
          <div class="plate-stack">
            <div
              v-for="(plate, index) in plateStack"
              :key="`right-${plate}-${index}`"
              class="plate"
              :style="plateStyle(plate)"
            >
              <span class="plate-label">{{ plate }}</span>
            </div>
          </div>
        </div>
        <div class="row" style="justify-content: space-between;">
          <span>Bar</span>
          <span>{{ preferences.barWeight }} kg</span>
        </div>
      </div>
    </div>

    <div class="card column">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <strong>Training partners</strong>
        <button v-if="!sharedSession" class="button secondary" @click="openPartnerModal">
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

    <div class="card column">
      <div class="row" style="justify-content: space-between;">
        <strong>Sets</strong>
        <span class="badge">
          {{ activeExercise?.setsDone ?? 0 }}/{{ activeExercise?.setsTarget ?? 0 }}
        </span>
      </div>
      <div class="row" style="justify-content: space-between;">
        <button class="button" :disabled="!activeExercise" @click="completeSet">
          Complete set
        </button>
        <button
          :class="['button', activeExercise?.warmupEnabled ? 'danger' : 'secondary']"
          :disabled="!activeExercise"
          @click="toggleWarmup"
        >
          Warmup
        </button>
      </div>
      <div v-if="activeExercise?.warmupEnabled" class="muted">
        Warmup set {{ (activeExercise?.warmupSetIndex ?? 0) + 1 }} weight:
        {{ warmupWeight }} kg
      </div>
      <div v-if="timerRemaining > 0" class="muted">
        Rest timer: {{ Math.ceil(timerRemaining / 1000) }}s
      </div>
    </div>

    <div class="card column">
      <button class="button danger" @click="finishExercise">Finish exercise</button>
    </div>

    <div class="card column">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <strong>History</strong>
        <button class="link-button danger" @click="removeExercise">
          Remove from database
        </button>
      </div>
      <div v-if="historyEntries.length === 0" class="muted">No history yet.</div>
      <div v-else class="column" style="gap: 8px;">
        <div
          v-for="entry in historyEntries"
          :key="entry.key"
          class="row"
          style="justify-content: space-between;"
        >
          <span>{{ entry.dateLabel }}</span>
          <span>{{ entry.weight }} kg</span>
          <span v-if="entry.partnerLabel" class="muted">with {{ entry.partnerLabel }}</span>
          <span :class="['status-pill', entry.success ? 'status-success' : 'status-missed']">
            {{ entry.success ? "Success" : "Missed" }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="showPartnerModal" class="modal-backdrop">
      <div class="modal card column">
        <div class="row" style="justify-content: space-between; align-items: center;">
          <strong>Add training partner</strong>
          <button class="button secondary" @click="closePartnerModal">Close</button>
        </div>

        <div class="row" style="gap: 8px; width: 100%;">
          <input
            v-model="searchTerm"
            class="input"
            placeholder="Search by display name or email"
            @keyup.enter="exercises.searchUsers(searchTerm)"
          />
          <button class="button" @click="exercises.searchUsers(searchTerm)">
            Search
          </button>
        </div>

        <div class="column" style="gap: 8px;">
          <strong>Friends</strong>
          <div v-if="friends.length === 0" class="muted">No friends yet.</div>
          <div v-for="friend in friends" :key="friend.uid" class="row partner-item">
            <span>{{ friend.displayName || friend.email }}</span>
            <div class="row" style="gap: 8px;">
              <button class="button" @click="startSharedSession(friend)">Add</button>
              <button class="button secondary" @click="unlinkFriend(friend.friendshipId)">
                Unlink
              </button>
            </div>
          </div>
        </div>

        <div v-if="searchResults.length" class="column" style="gap: 8px;">
          <strong>Search results</strong>
          <div v-for="user in searchResults" :key="user.uid" class="row partner-item">
            <span>{{ user.displayName || user.email }}</span>
            <div class="row" style="gap: 8px;">
              <button
                v-if="friendIds.has(user.uid)"
                class="button"
                @click="startSharedSession(user)"
              >
                Add
              </button>
              <button v-else class="button secondary" @click="sendRequest(user)">
                Send request
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="card">Loading...</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useExercisesStore } from "../stores/exercises";
import { useAuthStore } from "../stores/auth";
import { calculatePlates, getWarmupWeight } from "../utils/plateCalculator";
import { scheduleRestNotification } from "../utils/notifications";
import { db } from "../firebase";

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
});

const router = useRouter();
const exercises = useExercisesStore();
const auth = useAuthStore();
const timerRemaining = ref(0);
let timerInterval;
const showPartnerModal = ref(false);
const searchTerm = ref("");
const partnerExercise = ref(null);
let partnerExerciseUnsub = null;

const exercise = computed(() =>
  exercises.userExercises.find((item) => item.id === props.id)
);

const sharedSession = computed(() => exercises.sharedSession);
const isShared = computed(() => Boolean(sharedSession.value?.id));
const friends = computed(() => exercises.friends);
const friendRequests = computed(() => exercises.friendRequests);
const searchResults = computed(() => exercises.userSearchResults);
const friendIds = computed(() => new Set(friends.value.map((friend) => friend.uid)));
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
const activeExercise = computed(() => {
  if (!sharedSession.value) return exercise.value;
  if (activeUid.value === auth.user?.uid) return exercise.value;
  return partnerExercise.value;
});

const warmupWeight = computed(() => {
  if (!activeExercise.value) return 0;
  return getWarmupWeight(
    activeExercise.value.currentWeight,
    activeExercise.value.warmupSetIndex
  );
});

const preferences = computed(() => auth.preferences);
const historyEntries = computed(() => {
  if (!exercise.value?.history) return [];
  return [...exercise.value.history]
    .filter((entry) => entry && typeof entry.at === "number")
    .sort((a, b) => b.at - a.at)
    .map((entry) => ({
      key: `${entry.at}-${entry.weight}-${entry.success}`,
      dateLabel: new Date(entry.at).toLocaleDateString(),
      weight: entry.weight ?? "-",
      success: Boolean(entry.success),
      partnerLabel: entry.partner?.displayName ?? "",
    }));
});
const restTimerMs = computed(() => {
  const restSeconds = Number(
    sharedSession.value?.restTimerSeconds ?? preferences.value.restTimerSeconds
  );
  if (!Number.isFinite(restSeconds)) return 90_000;
  return Math.max(0, restSeconds) * 1000;
});

const timerSourceExercise = computed(() => {
  if (!sharedSession.value) return exercise.value;
  if (sharedSession.value.primaryUid === auth.user?.uid) return exercise.value;
  return partnerExercise.value;
});

const displayWeight = computed(() => {
  if (!activeExercise.value) return 0;
  return activeExercise.value.warmupEnabled
    ? warmupWeight.value
    : activeExercise.value.currentWeight;
});

const plateBreakdown = computed(() => {
  if (!exercise.value) return { plates: [], remaining: 0 };
  return calculatePlates(
    displayWeight.value,
    preferences.value.barWeight,
    preferences.value.plateConfig
  );
});

const plateStack = computed(() => {
  const stack = [];
  plateBreakdown.value.plates.forEach(({ plate, count }) => {
    for (let i = 0; i < count; i += 1) {
      stack.push(plate);
    }
  });
  return stack;
});

const activeParticipantLabel = computed(() => {
  if (!sharedSession.value) return "";
  if (activeUid.value === auth.user?.uid) return "You";
  return partnerProfile.value?.displayName || "Partner";
});

const sharedSuccess = computed(() => {
  if (!sharedSession.value) return false;
  const own = exercise.value;
  const partner = partnerExercise.value;
  if (!own || !partner) return false;
  return [own, partner].every(
    (item) => !item.warmupEnabled && item.setsDone >= item.setsTarget
  );
});

const plateColors = {
  20: "#2b64b4",
  15: "#e2c14b",
  10: "#2f8b57",
  5: "#c73b3b",
  2.5: "#1f1f1f",
  1.25: "#f5f5f2",
};

const plateColor = (plate) => plateColors[plate] ?? "#8a6f4a";
const plateTextColor = (plate) => (plate === 2.5 ? "#f5f5f2" : "rgba(0, 0, 0, 0.75)");

const plateStyle = (plate) => {
  const size = 32;
  const height = Math.min(92, Math.max(28, 26 + plate * 2.6));
  return {
    "--plate-color": plateColor(plate),
    "--plate-text-color": plateTextColor(plate),
    "--plate-width": `${size}px`,
    "--plate-height": `${height}px`,
  };
};

const getActiveTarget = () => {
  if (!sharedSession.value) {
    return { userId: auth.user?.uid, exerciseId: exercise.value?.id };
  }
  const userId = activeUid.value;
  const exerciseId = sharedSession.value.participants?.[userId]?.exerciseId;
  return { userId, exerciseId };
};

const adjustWeight = async (delta) => {
  if (!activeExercise.value) return;
  const { userId, exerciseId } = getActiveTarget();
  if (!userId || !exerciseId) return;
  const next = Math.max(
    activeExercise.value.currentWeight + delta,
    preferences.value.barWeight
  );
  await exercises.updateExerciseByUser(userId, exerciseId, { currentWeight: next });
};

const completeSet = async () => {
  if (!exercise.value) return;
  const currentSession = sharedSession.value;
  if (currentSession) {
    await exercises.completeSharedSet(currentSession, exercise.value);
    if (restTimerMs.value > 0 && currentSession.primaryUid === auth.user?.uid) {
      scheduleRestNotification(restTimerMs.value);
    }
    return;
  }
  const finished = await exercises.completeSet(exercise.value);
  if (finished) {
    router.push("/exercises");
    return;
  }
  if (restTimerMs.value > 0) {
    scheduleRestNotification(restTimerMs.value);
  }
};

const toggleWarmup = async () => {
  if (!activeExercise.value) return;
  const { userId, exerciseId } = getActiveTarget();
  if (!userId || !exerciseId) return;
  const update = {
    warmupEnabled: !activeExercise.value.warmupEnabled,
    warmupSetIndex: 0,
  };
  await exercises.updateExerciseByUser(userId, exerciseId, update);
};

const finishExercise = async () => {
  if (!exercise.value) return;
  if (sharedSession.value) {
    await exercises.finishSharedSession(sharedSession.value, { success: sharedSuccess.value });
    router.push("/exercises");
    return;
  }
  await exercises.finishExercise(exercise.value, { success: false });
  router.push("/exercises");
};

const removeExercise = async () => {
  if (!exercise.value) return;
  if (sharedSession.value?.status === "active") {
    window.alert("Finish the shared session before removing this exercise.");
    return;
  }
  const confirmed = window.confirm(
    `Remove "${exercise.value.name}" from your database? This cannot be undone.`
  );
  if (!confirmed) return;
  await exercises.deleteUserExercise(exercise.value.id);
  router.push("/exercises");
};

const updateTimerRemaining = () => {
  if (!timerSourceExercise.value?.timerEndsAt) {
    timerRemaining.value = 0;
    return;
  }
  const remaining = timerSourceExercise.value.timerEndsAt - Date.now();
  timerRemaining.value = Math.max(0, remaining);
  if (remaining <= 0) {
    if (sharedSession.value?.primaryUid === auth.user?.uid) {
      exercises.updateExercise(exercise.value.id, { timerEndsAt: null });
    }
  }
};

const openPartnerModal = () => {
  showPartnerModal.value = true;
  exercises.loadFriendships();
};

const closePartnerModal = () => {
  showPartnerModal.value = false;
  searchTerm.value = "";
  exercises.userSearchResults = [];
};

const startSharedSession = async (friend) => {
  if (!exercise.value) return;
  const sessionId = await exercises.createSharedSession(exercise.value, friend);
  if (sessionId) {
    exercises.subscribeSharedSession(sessionId);
  }
  closePartnerModal();
};

const sendRequest = async (user) => {
  await exercises.sendFriendRequest(user);
};

const acceptRequest = async (requestId) => {
  await exercises.acceptFriendRequest(requestId);
};

const declineRequest = async (requestId) => {
  await exercises.declineFriendRequest(requestId);
};

const unlinkFriend = async (friendshipId) => {
  await exercises.unlinkFriend(friendshipId);
};

onMounted(() => {
  exercises.subscribeUserExercises();
  exercises.loadFriendships();
  if (exercise.value?.sharedSessionId) {
    exercises.subscribeSharedSession(exercise.value.sharedSessionId);
  }
  updateTimerRemaining();
  timerInterval = setInterval(updateTimerRemaining, 1000);
});

onUnmounted(() => {
  clearInterval(timerInterval);
  clearTimeout(searchTimer);
  partnerExerciseUnsub?.();
  exercises.unsubscribeSharedSession?.();
});

watch(
  () => exercise.value?.sharedSessionId,
  (sessionId) => {
    if (!sessionId) {
      exercises.unsubscribeSharedSession?.();
      exercises.sharedSession = null;
      exercises.sharedSessionId = null;
      return;
    }
    exercises.subscribeSharedSession(sessionId);
  }
);

watch(
  () => [sharedSession.value?.id, exercise.value?.id],
  ([sessionId, exerciseId]) => {
    if (!sessionId || !exerciseId) return;
    const entry = sharedSession.value?.participants?.[auth.user?.uid];
    if (!entry?.exerciseId) {
      exercises.joinSharedSession(sessionId, exercise.value);
    }
  }
);

watch(
  () => [
    sharedSession.value?.id,
    partnerProfile.value?.uid,
    partnerProfile.value?.exerciseId,
  ],
  ([sessionId, partnerUid, partnerExerciseId]) => {
    if (!sessionId || !partnerUid || !partnerExerciseId) {
      partnerExercise.value = null;
      partnerExerciseUnsub?.();
      partnerExerciseUnsub = null;
      return;
    }
    if (sharedSession.value?.status === "finished") {
      partnerExercise.value = null;
      partnerExerciseUnsub?.();
      partnerExerciseUnsub = null;
      return;
    }
    partnerExerciseUnsub?.();
    const ref = doc(db, "users", partnerUid, "exercises", partnerExerciseId);
    partnerExerciseUnsub = onSnapshot(ref, (snap) => {
      partnerExercise.value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    });
  },
  { immediate: true }
);

watch(
  () => [sharedSession.value?.status, exercise.value?.sharedSessionId],
  ([status, sessionId]) => {
    if (status === "finished" && sessionId) {
      exercises.updateExercise(exercise.value.id, { sharedSessionId: null });
      router.push("/exercises");
    }
  }
);

let searchTimer;
watch(
  () => searchTerm.value,
  (value) => {
    clearTimeout(searchTimer);
    if (!value.trim()) {
      exercises.userSearchResults = [];
      return;
    }
    searchTimer = setTimeout(() => {
      exercises.searchUsers(value);
    }, 250);
  }
);
</script>
