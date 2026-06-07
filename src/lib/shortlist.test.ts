import { describe, expect, it } from "vitest";
import { toggleId } from "./shortlist";

describe("toggleId", () => {
  it("adds an id when absent", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
  });
  it("removes an id when present", () => {
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });
  it("does not mutate the input", () => {
    const input = ["a"];
    toggleId(input, "b");
    expect(input).toEqual(["a"]);
  });
});
