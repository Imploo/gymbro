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

    const buttons = wrapper.findAll("button");
    await buttons[0].trigger("click");
    await buttons[1].trigger("click");

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
