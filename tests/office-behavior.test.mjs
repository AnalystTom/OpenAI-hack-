import { test } from "node:test";
import assert from "node:assert/strict";
import { officePose, agentCharacter, liveInteractions } from "../src/officeBehavior.ts";
test("working agents stay at distinct desks while idle agents rest", () => {
  const positions = new Set();
  for (let i = 0; i < 6; i++) {
    const desk = officePose("working", i, 0, 6);
    assert.deepEqual(officePose("working", i, 10, 6), desk);
    assert.equal(desk.sitting, true);
    assert.equal(desk.walking, false);
    positions.add(`${desk.x}:${desk.z}`);
  }
  assert.equal(positions.size, 6);
  assert.deepEqual(
    officePose("idle", 0, 0, 6),
    officePose("idle", 0, 10, 6),
  );
  assert.equal(officePose("idle", 0, 27, 6).walking, false);
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
test("offline/unknown never simulate working and character mapping survives reordering", () => {
  for (const status of ["offline", "unknown", "blocked", "error"]) {
    const pose = officePose(status, 0, 10, 6);
    assert.equal(pose.sitting, false);
    assert.equal(pose.walking, false);
  }
  assert.equal(agentCharacter("a", "gpt-6-astra", "Codex"), "yellow-dot");
  assert.equal(agentCharacter("a", "gpt-6-luna", "Codex"), "purple-dot");
  assert.equal(agentCharacter("a", null, "Lovable"), "lovable");
});
test("seated agents face back toward their desk surface", () => {
  const pose = officePose("working", 0, 0, 6);
  assert.ok(
    Math.cos(pose.facing) < 0,
    "character looks toward negative Z where the desk is",
  );
  assert.ok(pose.z > -4.4 * 1.15, "seat is on the front side of the desk");
});
