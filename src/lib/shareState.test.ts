import { describe, expect, it } from "vitest";
import { decodeView, encodeView, type SharedView } from "./shareState";

const view: SharedView = {
  c: { includeVirtual: false, maxFee: 150, ageText: "7, 9", categories: ["STEM"], startDate: "2026-07-01", endDate: "2026-08-01" },
  t: "list",
  sv: "Audrey Moore Rec Center",
  sl: ["33S.QI2N", "6J2.B9BH"],
};

describe("shareState", () => {
  it("round-trips a view through encode/decode", () => {
    expect(decodeView(encodeView(view))).toEqual(view);
  });
  it("returns null on garbage", () => {
    expect(decodeView("not base64 %%%")).toBeNull();
    expect(decodeView(btoa("[]"))).toBeNull(); // not an object with criteria
  });
  it("fills defaults for missing optional fields", () => {
    const enc = encodeView({ c: { includeVirtual: false }, t: "calendar", sv: null, sl: [] });
    const dec = decodeView(enc)!;
    expect(dec.sv).toBeNull();
    expect(dec.sl).toEqual([]);
  });
});
