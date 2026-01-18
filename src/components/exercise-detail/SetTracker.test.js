import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import SetTracker from "./SetTracker.vue";

describe("SetTracker", () => {
  it("emits complete-set and toggle-warmup", async () => {
    const wrapper = mount(SetTracker, {
      props: {
        displaySetsDone: 1,
        displaySetsTarget: 5,
        activeExercise: { id: "ex", warmupEnabled: true },
        warmupWeight: 60,
        warmupSetLabel: 2,
        isWarmupEnabled: true,
        timerRemaining: 0,
      },
    });

    const completeButton = wrapper.get("button");
    const warmupToggle = wrapper.get('input[type="checkbox"]');
    await completeButton.trigger("click");
    await warmupToggle.setValue(false);

    expect(wrapper.emitted("complete-set")).toHaveLength(1);
    expect(wrapper.emitted("toggle-warmup")).toHaveLength(1);
  });

  it("shows rest timer when remaining", () => {
    const wrapper = mount(SetTracker, {
      props: {
        displaySetsDone: 1,
        displaySetsTarget: 5,
        activeExercise: { id: "ex", warmupEnabled: false },
        warmupWeight: 0,
        warmupSetLabel: 1,
        isWarmupEnabled: false,
        timerRemaining: 5000,
      },
    });

    expect(wrapper.text()).toContain("Rest timer");
  });
});
