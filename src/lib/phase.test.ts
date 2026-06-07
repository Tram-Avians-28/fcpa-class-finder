import { describe, expect, it } from "vitest";
import { phaseForVenue } from "./phase";

describe("phaseForVenue", () => {
  it("classifies blue and green venues", () => {
    expect(phaseForVenue("Audrey Moore Rec Center")).toBe("green");
    expect(phaseForVenue("Lake Accotink Park")).toBe("green");
    expect(phaseForVenue("Cub Run Rec Center")).toBe("blue");
    expect(phaseForVenue("Lake Fairfax Park")).toBe("blue");
  });

  it("handles the data's spelling variants", () => {
    expect(phaseForVenue("Frying Pan Park")).toBe("blue"); // map: "Frying Pan Farm Park"
    expect(phaseForVenue("Westfields High School")).toBe("blue"); // map: "Westfield High School"
    expect(phaseForVenue("Woodley Hills Elementary")).toBe("green"); // map: "...Elementary School"
  });

  it("is case/spacing insensitive", () => {
    expect(phaseForVenue("  audrey   moore rec center ")).toBe("green");
  });

  it("returns 'unknown' for venues not on the published map", () => {
    expect(phaseForVenue("Colin Powell Elementary School")).toBe("unknown");
    expect(phaseForVenue("GMUFieldHouse")).toBe("unknown");
    expect(phaseForVenue("Virtual FCPA")).toBe("unknown");
  });
});
