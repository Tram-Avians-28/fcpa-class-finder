import { describe, expect, it } from "vitest";
import { createActivitySearch } from "./search";

describe("activity search syntax", () => {
  it("keeps unquoted terms as case-insensitive alternatives and supports partial words", () => {
    const matches = createActivitySearch("  SWIM\tpottery\n");
    expect(matches("Swimming Basics")).toBe(true);
    expect(matches("Creative Studio", "Learn pottery techniques.")).toBe(true);
    expect(matches("Soccer Skills")).toBe(false);
  });

  it("requires quoted words to occur together in order within one field", () => {
    const matches = createActivitySearch('"water exercise"');
    expect(matches("Water Exercise for Beginners")).toBe(true);
    expect(matches("Fitness", "Try WATER EXERCISE today.")).toBe(true);
    expect(matches("Exercise in the Water")).toBe(false);
    expect(matches("Water", "Exercise for beginners")).toBe(false);
    expect(matches("Underwater Exercise")).toBe(false);
    expect(matches("Water Exercises")).toBe(false);
  });

  it("supports quoted single words, including Unicode word boundaries", () => {
    const matches = createActivitySearch('"art"');
    expect(matches("Art (6–9 yrs.)")).toBe(true);
    expect(matches("Martial Arts")).toBe(false);
    expect(matches("arté")).toBe(false);
    expect(createActivitySearch('"café"')("Café Workshop")).toBe(true);
    expect(createActivitySearch('"café"')("Caféteria Tour")).toBe(false);
  });

  it("treats positive words and phrases as alternatives", () => {
    const matches = createActivitySearch('"water exercise" swimming "soccer skills"');
    expect(matches("Water Exercise")).toBe(true);
    expect(matches("Swimming Basics")).toBe(true);
    expect(matches("Soccer Skills")).toBe(true);
    expect(matches("Water Safety")).toBe(false);
  });

  it("applies every excluded word or phrase across both fields and all positive terms", () => {
    const matches = createActivitySearch('swimming "water exercise" -advanced -"deep water"');
    expect(matches("Swimming Basics")).toBe(true);
    expect(matches("Water Exercise", "Shallow pool fitness")).toBe(true);
    expect(matches("Advanced Swimming")).toBe(false);
    expect(matches("Swimming", "Designed for ADVANCED students")).toBe(false);
    expect(matches("Water Exercise", "Held in the deep water pool")).toBe(false);
    expect(matches("Deep Water Swimming")).toBe(false);
    expect(matches("Soccer Skills")).toBe(false);
  });

  it("allows exclusions-only queries and keeps phrase exclusions exact", () => {
    const matches = createActivitySearch('-advanced -"deep water"');
    expect(matches("Swimming Basics")).toBe(true);
    expect(matches("Advanced Art")).toBe(false);
    expect(matches("Swimming", "Deep water skills")).toBe(false);
    expect(matches("Swimming", "Water safety in deep pools")).toBe(true);
  });

  it("accepts straight, curly, and mixed quotes and normalizes repeated whitespace", () => {
    const matches = createActivitySearch('“WATER   exercise” -“deep\twater”');
    expect(matches("Water\nExercise")).toBe(true);
    expect(matches("Water Exercise", "Deep   water training")).toBe(false);
    expect(createActivitySearch('“water exercise"')("Water Exercise")).toBe(true);
  });

  it("handles unfinished quotes as phrases through the end of the query", () => {
    expect(createActivitySearch('"water exercise')("Water Exercise")).toBe(true);
    expect(createActivitySearch('"water exercise')("Exercise in Water")).toBe(false);
    const matches = createActivitySearch('swimming -"deep water');
    expect(matches("Swimming Basics")).toBe(true);
    expect(matches("Deep Water Swimming")).toBe(false);
  });

  it.each([undefined, "", "  \t\n ", '""', '“ ”', "-", '-""'])
    ("ignores empty input or empty operators: %s", (query) => {
      expect(createActivitySearch(query)("Swimming Basics")).toBe(true);
    });

  it("treats internal hyphens and regex characters literally", () => {
    expect(createActivitySearch("school-year")("School-Year Camps")).toBe(true);
    expect(createActivitySearch("school-year")("School Camps")).toBe(false);
    expect(createActivitySearch("c++")("C++ Workshop")).toBe(true);
    expect(createActivitySearch('"[art]"')("[Art] Workshop")).toBe(true);
    expect(createActivitySearch('"[art]"')("Art Workshop")).toBe(false);
    expect(createActivitySearch(".*")("Swimming Basics")).toBe(false);
    expect(createActivitySearch('art -"(advanced)"')("Art (Advanced)")).toBe(false);
  });
});
