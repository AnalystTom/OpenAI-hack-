import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createOfficeReplay,
  appendOfficeReplay,
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

test("imports skip recorded idle lead-ins and new arrivals start work on their own clock", () => {
  const start = Date.UTC(2026, 9, 6);
  const resident = agent("resident", start, 30000);
  const arrival = agent("arrival", start, 60000);
  arrival.history.unshift({ at: new Date(start - 120000).toISOString(), status: "idle", label: "Waiting for a task" });
  const originalHistory = structuredClone(arrival.history);
  const initial = createOfficeReplay([resident, arrival]);
  assert.equal(initial.durationMs, 60000);
  assert.deepEqual(replayOffice(initial, 0).map(a => a.status), ["working", "working"]);
  const joined = appendOfficeReplay(createOfficeReplay([resident]), [arrival], 30000);
  assert.equal(joined.durationMs, 90000);
  assert.deepEqual(replayOffice(joined, 30000).map(a => a.status), ["idle", "working"]);
  assert.equal(replayOffice(joined, 90000)[1].status, "idle");
  assert.deepEqual(arrival.history, originalHistory, "source timestamps remain intact");
});

test("idle-only recordings are not turned into work", () => {
  const resting = agent("resting", Date.UTC(2026, 9, 6), 30000);
  resting.history[0].status = "idle";
  assert.equal(replayOffice(createOfficeReplay([resting]), 0)[0].status, "idle");
});
