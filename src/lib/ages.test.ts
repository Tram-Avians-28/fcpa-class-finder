import { describe, expect, it } from "vitest";
import { parseAges } from "./ages";

describe("parseAges", () => {
  it("parses single ages and comma lists", () => {
    expect(parseAges("7")).toEqual([7]);
    expect(parseAges("7, 9")).toEqual([7, 9]);
    expect(parseAges("9, 7, 9")).toEqual([7, 9]); // sorted + deduped
  });
  it("expands hyphen ranges", () => {
    expect(parseAges("6-10")).toEqual([6, 7, 8, 9, 10]);
    expect(parseAges("10-6")).toEqual([6, 7, 8, 9, 10]); // reversed range
  });
  it("mixes ranges and singles", () => {
    expect(parseAges("5, 8-10")).toEqual([5, 8, 9, 10]);
  });
  it("ignores junk and blanks", () => {
    expect(parseAges("")).toEqual([]);
    expect(parseAges("abc, , 8")).toEqual([8]);
  });
  it("caps absurd ranges", () => {
    expect(parseAges("1-100000").length).toBeLessThanOrEqual(31);
  });
});
