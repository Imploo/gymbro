<template>
  <div class="card column">
    <div class="row space-between">
      <h2>{{ exerciseName }}</h2>
      <div class="row gap-8 align-center">
        <span v-if="activeParticipantLabel" class="badge secondary">
          {{ activeParticipantLabel }}
        </span>
        <span class="badge">{{ displayWeight }} kg</span>
      </div>
    </div>

    <div class="row space-between">
      <button class="button secondary" :disabled="!activeExercise" @click="adjust(-2.5)">
        -2.5
      </button>
      <button class="button" :disabled="!activeExercise" @click="adjust(2.5)">
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
      <div class="row space-between">
        <span>Bar</span>
        <span>{{ barWeight }} kg</span>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  exerciseName: {
    type: String,
    required: true,
  },
  displayWeight: {
    type: Number,
    required: true,
  },
  activeParticipantLabel: {
    type: String,
    default: "",
  },
  activeExercise: {
    type: Object,
    default: null,
  },
  plateStack: {
    type: Array,
    default: () => [],
  },
  plateStyle: {
    type: Function,
    required: true,
  },
  barWeight: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(["adjust"]);

const adjust = (delta) => {
  emit("adjust", delta);
};
</script>
