import { describe, expect, it } from "bun:test";
import { normalizeExerciseName } from "../src/services/exercises";

describe("normalizeExerciseName", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(normalizeExerciseName("  Barbell   Bench \t Press  ")).toBe("barbell bench press");
  });

  it("treats case and spacing variants as the same exercise", () => {
    expect(normalizeExerciseName("Pull-Up")).toBe(normalizeExerciseName("  pull-up "));
    expect(normalizeExerciseName("Romanian   Deadlift")).toBe("romanian deadlift");
  });

  it("keeps distinct names distinct", () => {
    expect(normalizeExerciseName("Front Squat")).not.toBe(normalizeExerciseName("Back Squat"));
  });
});
