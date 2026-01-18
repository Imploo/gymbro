import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import WeightControl from "./WeightControl.vue";

describe("WeightControl", () => {
  it("renders exercise name and weight", () => {
    const wrapper = mount(WeightControl, {
      props: {
        exerciseName: "Bench Press",
        displayWeight: 100,
        activeParticipantLabel: "You",
        activeExercise: { id: "ex" },
        plateStack: [20, 20],
        plateStyle: () => ({}),
        barWeight: 20,
      },
    });

    expect(wrapper.text()).toContain("Bench Press");
    expect(wrapper.text()).toContain("100 kg");
  });

  it("emits adjust with the requested delta", async () => {
    const wrapper = mount(WeightControl, {
      props: {
        exerciseName: "Bench Press",
        displayWeight: 100,
        activeParticipantLabel: "",
        activeExercise: { id: "ex" },
        plateStack: [],
        plateStyle: () => ({}),
        barWeight: 20,
      },
    });

    const buttons = wrapper.findAll("button");
    await buttons[0].trigger("click");
    await buttons[1].trigger("click");

    expect(wrapper.emitted("adjust")).toEqual([[-2.5], [2.5]]);
  });
});
