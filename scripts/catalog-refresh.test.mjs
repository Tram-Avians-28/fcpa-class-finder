import assert from "node:assert/strict";
import { test } from "node:test";
import { preserveUnrefreshedActivities } from "./catalog-refresh.mjs";

test("camp refresh replaces expired camps and preserves every non-camp record", () => {
  const pottery = { catalogId: "art", category: "FINE ARTS", fee: 25 };
  const old = [pottery, { catalogId: "old", category: "CAMPS SUMMER" }];
  const current = { catalogId: "new", category: "CAMPS SCHOOL YEAR" };
  const target = new Map([[current.catalogId, current]]);
  preserveUnrefreshedActivities(target, old, new Set(["CAMPS SUMMER", "CAMPS SCHOOL YEAR"]));
  assert.deepEqual([...target.values()], [current, pottery]);
});

test("a single-category refresh retains other camp categories", () => {
  const summer = { catalogId: "summer", category: "CAMPS SUMMER" };
  const winter = { catalogId: "winter", category: "CAMPS SCHOOL YEAR" };
  const target = new Map([[winter.catalogId, winter]]);
  preserveUnrefreshedActivities(target, [summer], new Set(["CAMPS SCHOOL YEAR"]));
  assert.equal(target.get("summer"), summer);
});

test("a newly collected ID wins if a session changed category", () => {
  const current = { catalogId: "same", category: "CAMPS SCHOOL YEAR" };
  const target = new Map([[current.catalogId, current]]);
  preserveUnrefreshedActivities(target, [{ catalogId: "same", category: "SPECIAL PROGRAMS" }], new Set([current.category]));
  assert.equal(target.size, 1);
  assert.equal(target.get("same"), current);
});

test("empty or invalid partial refreshes fail before existing records are merged", () => {
  const target = new Map();
  assert.throws(() => preserveUnrefreshedActivities(target, [], new Set()), /No activities collected/);
  assert.throws(() => preserveUnrefreshedActivities(target, null, new Set()), /existing activity catalog/);
  assert.equal(target.size, 0);
});
