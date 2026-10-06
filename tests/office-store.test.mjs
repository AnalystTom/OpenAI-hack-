import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeOfficeAgents, readSavedOffice, serializeOffice } from "../src/officeStore.ts";
import { createOfficeReplay, appendOfficeReplay, replayOffice } from "../src/officeReplay.ts";

const recorded = (id) => ({
  id, name: id, harness: "Codex", model: null, task: null,
  status: "idle", contextUsed: null, contextWindow: null,
  updatedAt: "2026-10-06T10:01:00.000Z",
  history: [
    { at: "2026-10-06T10:00:00.000Z", status: "working", label: "Task started" },
    { at: "2026-10-06T10:01:00.000Z", status: "idle", label: "Task completed" },
  ],
});

test("imports join existing residents, deduplicate and preserve newer source data", () => {
  const a = recorded("a"), b = recorded("b");
  const updated = { ...a, name: "Updated title", updatedAt: "2026-10-06T11:00:00.000Z" };
  const merged = mergeOfficeAgents([a], [b, updated]);
  assert.deepEqual(merged.map(a => a.id), ["a", "b"]);
  assert.equal(merged[0].name, "Updated title");
  assert.deepEqual(mergeOfficeAgents(merged, [a, b]), merged);
  assert.deepEqual(readSavedOffice({ getItem: () => serializeOffice(merged) }).agents, merged);
  assert.ok(readSavedOffice({ getItem: () => "broken" }).error);
});

test("joining a replay preserves old clocks and starts the new agent at arrival", () => {
  let replay = createOfficeReplay([recorded("a")]);
  replay = appendOfficeReplay(replay, [recorded("b")], 30000);
  assert.equal(replay.durationMs, 90000);
  assert.deepEqual(replayOffice(replay, 60000).map(a => a.status), ["idle", "working"]);
  replay = appendOfficeReplay(replay, [recorded("a"), recorded("b")], 60000);
  assert.equal(replay.agents.length, 2);
  assert.deepEqual(replayOffice(replay, 90000).map(a => a.status), ["idle", "idle"]);
});

test("recorded session links survive saving and refresh", () => {
  const agents = [recorded("a"), recorded("b")];
  const links = [{ fromId: "a", toId: "b", at: agents[0].updatedAt, kind: "delegation" }];
  const restored = readSavedOffice({ getItem: () => serializeOffice(agents, links) });
  assert.deepEqual(restored.interactions, links);
});
