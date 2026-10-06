import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOfficeSnapshot } from "../src/snapshot.ts";
const agent = {
  id: "test-session",
  name: "Parser test",
  harness: "codex",
  model: null,
  task: null,
  status: "unknown",
  contextUsed: null,
  contextWindow: null,
  updatedAt: "2026-10-06T17:00:00Z",
};
const encode = (agents) => JSON.stringify({ version: 1, agents });
test("keeps missing telemetry unknown and allows empty offices", () => {
  assert.deepEqual(parseOfficeSnapshot(encode([])).agents, []);
  assert.equal(
    parseOfficeSnapshot(encode([agent])).agents[0].contextUsed,
    null,
  );
});
test("rejects malformed snapshots, duplicate identity, and invalid context", () => {
  for (const text of [
    "not-json",
    "{}",
    encode([agent, agent]),
    encode([{ ...agent, contextWindow: 0 }]),
    encode([{ ...agent, contextUsed: -1 }]),
    encode([{ ...agent, status: "made-up" }]),
  ])
    assert.throws(() => parseOfficeSnapshot(text));
});
test("accepts recorded links only for known distinct sessions", () => {
  const other = { ...agent, id: "second-session" };
  const link = { fromId: agent.id, toId: other.id, kind: "message", at: "2026-10-06T18:00:00Z" };
  assert.equal(parseOfficeSnapshot(JSON.stringify({ version: 1, agents: [agent, other], interactions: [link] })).interactions.length, 1);
  for (const bad of [{ ...link, toId: "missing" }, { ...link, fromId: other.id, toId: other.id }, { ...link, at: "no date" }, { ...link, kind: "guessed" }]) {
    assert.throws(() => parseOfficeSnapshot(JSON.stringify({ version: 1, agents: [agent, other], interactions: [bad] })));
  }
});
