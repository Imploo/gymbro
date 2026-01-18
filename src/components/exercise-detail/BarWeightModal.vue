<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal card column">
      <div class="row space-between align-center">
        <strong>Bar weight</strong>
        <button class="button secondary" type="button" @click="$emit('close')">
          Close
        </button>
      </div>
      <label class="muted">Override for this exercise (kg)</label>
      <div class="row gap-8 align-center">
        <input
          class="input"
          type="number"
          min="0"
          step="0.5"
          :value="modelValue"
          :placeholder="placeholder"
          @input="onInput"
        />
        <button
          class="button secondary"
          type="button"
          :disabled="!isOverride"
          @click="$emit('reset')"
        >
          Use default
        </button>
        <button class="button" type="button" :disabled="!isDirty" @click="$emit('save')">
          Save
        </button>
      </div>
      <p v-if="!isOverride" class="muted">Using default: {{ defaultLabel }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "",
  },
  isOverride: {
    type: Boolean,
    default: false,
  },
  isDirty: {
    type: Boolean,
    default: false,
  },
  defaultLabel: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue", "close", "save", "reset"]);

const onInput = (event) => {
  emit("update:modelValue", event.target.value);
};
</script>
