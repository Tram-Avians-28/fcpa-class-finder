import { describe, expect, it } from "vitest";
import {
  cellText,
  excelDateToISO,
  parseAgeYears,
  parseClockTime,
  parseFee,
} from "./normalize";

describe("parseClockTime", () => {
  it("parses Excel time fractions (Start Time column)", () => {
    expect(parseClockTime(0.375)).toBe("09:00"); // 9/24
    expect(parseClockTime(13 / 24)).toBe("13:00");
    expect(parseClockTime(16 / 24)).toBe("16:00");
    expect(parseClockTime(0.5)).toBe("12:00");
  });

  it("parses text times with a leading space (End Time column)", () => {
    expect(parseClockTime(" 4:00 PM")).toBe("16:00");
    expect(parseClockTime(" 12:00 PM")).toBe("12:00");
    expect(parseClockTime(" 9:00 AM")).toBe("09:00");
    expect(parseClockTime("12:30 AM")).toBe("00:30");
    expect(parseClockTime("4:30 PM")).toBe("16:30");
  });

  it("parses Date values", () => {
    const d = new Date(2020, 0, 1, 14, 5);
    expect(parseClockTime(d)).toBe("14:05");
  });

  it("returns null for blank/garbage", () => {
    expect(parseClockTime("")).toBeNull();
    expect(parseClockTime(null)).toBeNull();
    expect(parseClockTime(undefined)).toBeNull();
    expect(parseClockTime("noon")).toBeNull();
    expect(parseClockTime("25:00")).toBeNull();
  });
});

describe("parseAgeYears", () => {
  it("parses 'N Years'", () => {
    expect(parseAgeYears("6 Years")).toBe(6);
    expect(parseAgeYears("13 Years")).toBe(13);
  });

  it("parses years + months into fractional years", () => {
    expect(parseAgeYears("3 Years 6 Months")).toBe(3.5);
    expect(parseAgeYears("5 Years 3 Months")).toBe(5.25);
  });

  it("handles bare numbers and numeric strings", () => {
    expect(parseAgeYears(7)).toBe(7);
    expect(parseAgeYears("8")).toBe(8);
  });

  it("returns null for blank/garbage", () => {
    expect(parseAgeYears("")).toBeNull();
    expect(parseAgeYears(null)).toBeNull();
    expect(parseAgeYears("all ages")).toBeNull();
  });
});

describe("excelDateToISO", () => {
  it("converts an Excel date serial (UTC, no tz drift)", () => {
    const serial = Date.UTC(2026, 4, 25) / 86400000 + 25569;
    expect(excelDateToISO(serial)).toBe("2026-05-25");
    const serial2 = Date.UTC(2026, 8, 4) / 86400000 + 25569;
    expect(excelDateToISO(serial2)).toBe("2026-09-04");
  });

  it("handles Date and ISO string inputs", () => {
    expect(excelDateToISO(new Date(2026, 5, 22))).toBe("2026-06-22");
    expect(excelDateToISO("2026-07-13")).toBe("2026-07-13");
  });

  it("returns null for blank/garbage", () => {
    expect(excelDateToISO("")).toBeNull();
    expect(excelDateToISO(null)).toBeNull();
    expect(excelDateToISO("not a date")).toBeNull();
  });
});

describe("parseFee", () => {
  it("parses numbers and currency strings", () => {
    expect(parseFee(89)).toBe(89);
    expect(parseFee("$1,440")).toBe(1440);
    expect(parseFee(" 39 ")).toBe(39);
  });
  it("returns null for non-numeric", () => {
    expect(parseFee("free")).toBeNull();
    expect(parseFee("")).toBeNull();
    expect(parseFee(null)).toBeNull();
  });
});

describe("cellText", () => {
  it("trims and stringifies, blank for nullish", () => {
    expect(cellText("  hi  ")).toBe("hi");
    expect(cellText(null)).toBe("");
    expect(cellText(42)).toBe("42");
  });
});
