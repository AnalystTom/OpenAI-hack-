import { test } from "node:test";
import assert from "node:assert/strict";
import { officePose, agentCharacter } from "../src/officeBehavior.ts";
test("working agents stay at distinct desks while idle agents move", () => {
  const positions = new Set();
  for (let i = 0; i < 6; i++) {
    const desk = officePose("working", i, 0, 6);
    assert.deepEqual(officePose("working", i, 10, 6), desk);
    assert.equal(desk.sitting, true);
    assert.equal(desk.walking, false);
    positions.add(`${desk.x}:${desk.z}`);
  }
  assert.equal(positions.size, 6);
  assert.notDeepEqual(
    officePose("idle", 0, 0, 6),
    officePose("idle", 0, 10, 6),
  );
  assert.equal(officePose("idle", 0, 27, 6).walking, false);
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
