import { test } from "node:test";
import assert from "node:assert/strict";
import { officePose, officeLayout, agentCharacter, liveInteractions } from "../src/officeBehavior.ts";
test("working agents use desks while unoccupied agents walk the room", () => {
  const positions = new Set();
  for (let i = 0; i < 6; i++) {
    const desk = officePose("working", i, 0, 6);
    assert.deepEqual(officePose("working", i, 10, 6), desk);
    assert.equal(desk.sitting, true);
    assert.equal(desk.walking, false);
    positions.add(`${desk.x}:${desk.z}`);
  }
  assert.equal(positions.size, 6);
  assert.equal(officePose("idle", 0, 0, 6).walking, true);
  assert.equal(officePose("unknown", 1, 0, 6).walking, true);
  assert.equal(officePose("idle", 2, 0, 6).walking, true);
  assert.notDeepEqual(officePose("idle", 2, 0, 6), officePose("idle", 2, 10, 6));
  assert.notDeepEqual(officePose("working", 0, 0, 6, false, { slot: 0, side: "from" }), officePose("working", 1, 0, 6, false, { slot: 0, side: "to" }));
  const from = officePose("working", 0, 0, 6, false, { slot: 0, side: "from" });
  const to = officePose("working", 1, 0, 6, false, { slot: 0, side: "to" });
  assert.equal(from.sitting, false);
  assert.ok(from.x < 3.6 && to.x > 3.6, "linked agents face each other at the team-up station");
  assert.deepEqual(officePose("working", 0, 0, 6, true, { slot: 0, side: "from" }), officePose("working", 0, 0, 6, true), "confirmed retries keep their own movement even when a link exists");
});
test("only recent recorded links between two working sessions trigger team play", () => {
  const now = Date.parse("2026-10-06T18:00:00Z");
  const agent = (id, status = "working") => ({ id, status });
  const agents = [agent("a"), agent("b"), agent("c", "idle"), agent("d")];
  const link = (fromId, toId, age, kind = "message") => ({ fromId, toId, at: new Date(now - age).toISOString(), kind });
  const selected = liveInteractions(agents, [
    link("a", "b", 100000),
    link("a", "c", 1000),
    link("a", "b", 2000),
    link("b", "d", 3000),
  ], now);
  assert.equal(selected.length, 1);
  assert.deepEqual([selected[0].fromId, selected[0].toId, selected[0].slot], ["a", "b", 0]);
  assert.deepEqual(liveInteractions(agents, [link("a", "b", -30000)], now), []);
});
test("unconfirmed sessions rest or walk without simulating work; character mapping survives reordering", () => {
  for (const status of ["offline", "unknown", "blocked", "error"]) {
    const pose = officePose(status, 2, 10, 6);
    assert.equal(pose.sitting, false);
    assert.equal(pose.walking, true);
  }
  const ids = ["session-a", "session-b", "session-c"];
  assert.deepEqual(ids.map(agentCharacter), [...ids].reverse().map(agentCharacter).reverse());
  const appearances = new Set(Array.from({length: 30}, (_, i) => agentCharacter(`session-${i}`)));
  assert.equal(appearances.size, 6, "one model can use every character");
});
test("seated agents face back toward their desk surface", () => {
  const pose = officePose("working", 0, 0, 6);
  assert.ok(
    Math.cos(pose.facing) < 0,
    "character looks toward negative Z where the desk is",
  );
  assert.ok(pose.z > -4.4 * 1.15, "seat is on the front side of the desk");
});

test("all 50 imported agents have distinct desks inside the expanded room", () => {
  const layout = officeLayout(50);
  const seats = new Set();
  for (let i = 0; i < 50; i++) {
    const seat = officePose("working", i, 0, 50);
    seats.add(`${seat.x}:${seat.z}`);
    assert.ok(seat.x > layout.x - layout.width / 2 && seat.x < layout.x + layout.width / 2);
    assert.ok(seat.z > layout.z - layout.depth / 2 && seat.z < layout.z + layout.depth / 2);
  }
  assert.equal(seats.size, 50);
  assert.equal(officeLayout(0).desks.length, 12);
  assert.equal(officeLayout(18).desks.length, 18);
});

test("all non-working statuses follow the central carpet without parking", () => {
  for (const total of [1, 6, 12, 25, 50]) {
    const { carpet } = officeLayout(total);
    assert.ok(carpet.width > 20);
    for (const status of ["preview", "idle", "unknown", "offline", "blocked", "error"]) {
      for (const time of [0, 10, 30, 60, 180]) {
        for (let i = 0; i < total; i++) {
          const a = officePose(status, i, time, total);
          const b = officePose(status, i, time + 1, total);
          assert.ok(a.walking && !a.sitting);
          assert.ok(Math.hypot(b.x - a.x, b.z - a.z) > 0.02);
          assert.ok(Math.abs(a.x - carpet.x) <= carpet.width / 2 - 0.75);
          assert.ok(Math.abs(a.z - carpet.z) <= carpet.depth / 2 - 0.75);
          assert.ok(a.z > -2 && a.z < 2, "walk between the desk rows");
        }
      }
    }
  }
});
