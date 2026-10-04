import test from "node:test";
import assert from "node:assert/strict";
import {
  creditedDelta,
  demoteCount,
  MAX_DELTA_PER_SYNC,
  previousWeekStart,
  promoteCount,
  resolveMovement,
  totalXpFromLevel,
  weekStartUtc,
} from "./league";

test("week starts on Monday (UTC)", () => {
  assert.equal(weekStartUtc(new Date("2026-10-04T14:00:00Z")), "2026-09-28"); // Sunday
  assert.equal(weekStartUtc(new Date("2026-10-05T00:00:00Z")), "2026-10-05"); // Monday
  assert.equal(weekStartUtc(new Date("2026-10-07T23:59:59Z")), "2026-10-05");
  assert.equal(previousWeekStart("2026-10-05"), "2026-09-28");
});

test("total xp rebuilds from level and in-level xp", () => {
  assert.equal(totalXpFromLevel(1, 120), 120);
  assert.equal(totalXpFromLevel(2, 0), 500);
  assert.equal(totalXpFromLevel(3, 10), 500 + 625 + 10);
  assert.equal(totalXpFromLevel(4, 0), 500 + 625 + 781);
});

test("credited xp is never negative and is capped", () => {
  assert.equal(creditedDelta(100, 50), 0);
  assert.equal(creditedDelta(100, 160), 60);
  assert.equal(creditedDelta(0, 10_000_000), MAX_DELTA_PER_SYNC);
});

test("promotion and demotion counts scale with group size", () => {
  assert.equal(promoteCount(30), 10);
  assert.equal(promoteCount(6), 2);
  assert.equal(promoteCount(1), 1);
  assert.equal(demoteCount(30), 5);
  assert.equal(demoteCount(9), 0);
  assert.equal(demoteCount(12), 2);
});

test("movement: top promotes, bottom demotes, middle stays, edges respected", () => {
  assert.deepEqual(resolveMovement(1, 1, 30, 400), { tier: 2, result: "promoted" });
  assert.deepEqual(resolveMovement(1, 15, 30, 100), { tier: 1, result: "stayed" });
  assert.deepEqual(resolveMovement(1, 28, 30, 0), { tier: 0, result: "demoted" });
  assert.deepEqual(resolveMovement(0, 30, 30, 0), { tier: 0, result: "stayed" }); // already bottom tier
  assert.deepEqual(resolveMovement(4, 1, 30, 900), { tier: 4, result: "stayed" }); // already top tier
  assert.deepEqual(resolveMovement(0, 1, 30, 0), { tier: 0, result: "stayed" }); // 0 xp can't promote
  assert.deepEqual(resolveMovement(2, 8, 8, 0), { tier: 2, result: "stayed" }); // small group no demote
});
