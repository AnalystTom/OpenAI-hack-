import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createOfficeReplay,
  replayOffice,
  officeSummary,
} from "../src/officeReplay.ts";
const agent = (id, start, duration) => ({
  id,
  name: id,
  harness: "Codex",
  model: null,
  status: "idle",
  task: `Task ${id}`,
  contextUsed: null,
  contextWindow: null,
  updatedAt: new Date(start + duration).toISOString(),
  history: [
    {
      at: new Date(start).toISOString(),
      status: "working",
      label: "Task started",
    },
    {
      at: new Date(start + duration).toISOString(),
      status: "idle",
      label: "Task completed",
    },
  ],
});
test("sessions from different dates start together and keep relative durations", () => {
  const a = agent("a", Date.UTC(2026, 9, 4), 10000),
    b = agent("b", Date.UTC(2026, 9, 6), 30000);
  const replay = createOfficeReplay([a, b]);
  assert.deepEqual(
    replayOffice(replay, 0).map((a) => a.status),
    ["working", "working"],
  );
  assert.deepEqual(
    replayOffice(replay, 15000).map((a) => a.status),
    ["idle", "working"],
  );
  assert.deepEqual(
    replayOffice(replay, 30000).map((a) => a.status),
    ["idle", "idle"],
  );
  assert.equal(replay.durationMs, 30000);
  a.history[0].status = "error";
  assert.equal(
    replayOffice(replay, 0)[0].status,
    "working",
    "polling/source edits do not alter frozen replay",
  );
});
test("no recording means unknown rather than a fabricated task", () => {
  const a = agent("a", Date.UTC(2026, 9, 4), 10000);
  const missing = { ...a, id: "missing", history: undefined };
  assert.equal(createOfficeReplay([missing]), null);
  const view = replayOffice(createOfficeReplay([a, missing]), 0);
  assert.equal(view[1].status, "unknown");
  assert.equal(view[0].contextUsed, null);
  assert.match(officeSummary(view, true), /1 agent is working/);
  assert.match(officeSummary(view, true), /Replay/);
});
