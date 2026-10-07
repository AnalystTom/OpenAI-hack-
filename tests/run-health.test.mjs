import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSessionEvents } from "../server/codex-sessions.mjs";
import { officePose } from "../src/officeBehavior.ts";
import { parseOfficeSnapshot } from "../src/snapshot.ts";
const now = Date.parse("2026-10-06T12:00:10Z");
const event = (type, payload) => JSON.stringify({ timestamp: "2026-10-06T12:00:00Z", type, payload });
const start = event("event_msg", { type: "task_started" });
const call = (id, input = "private input") => event("response_item", { type: "function_call", name: "exec_command", call_id: id, arguments: input });
const result = (id, output) => event("response_item", { type: "function_call_output", call_id: id, output });
const parse = (...rows) => parseSessionEvents(rows.join("\n"), now);

test("confirmed failed input starts circling only during the matching retry", () => {
  const rows = [start, call("one"), result("one", { exit_code: 1, output: "private output" }), call("two")];
  const retry = parse(...rows);
  assert.equal(retry.health.retrying, true);
  assert.equal(retry.health.state, "watch");
  assert.equal(retry.health.retries, 1);
  const recovered = parse(...rows, result("two", { exit_code: 0 }));
  assert.equal(recovered.health.retrying, false);
  assert.equal(recovered.health.recoveredRetries, 1);
  assert.equal(recovered.health.state, "healthy");
  assert.doesNotMatch(JSON.stringify(retry), /private input|private output|arguments|signature|call_id/);
});

test("successful repetition, changed input and unknown outcomes are not confirmed retries", () => {
  assert.equal(parse(start, call("one"), result("one", { exit_code: 0 }), call("two")).health.retrying, false);
  assert.equal(parse(start, call("one"), result("one", { exit_code: 1 }), call("two", "different")).health.retrying, false);
  assert.equal(parse(start, call("one"), result("one", "discussion of an error"), call("two")).health.retrying, false);
  const unknown = parse(start, call("one"), result("one", { exit_code: 1 }), call("two"), result("two", "unknown"));
  assert.equal(unknown.health.retrying, false);
  assert.equal(unknown.health.recoveredRetries, 0);
});

test("stale logs, interrupted turns and next turns stop retrying", () => {
  const rows = [start, call("one"), result("one", { content: [{ text: '"Exit code: 2"' }] }), call("two")];
  assert.equal(parse(...rows).health.retrying, true);
  const stale = parseSessionEvents(rows.join("\n"), now + 600_000);
  assert.equal(stale.health.state, "unknown");
  assert.equal(stale.health.retrying, false);
  assert.equal(parse(...rows, event("event_msg", { type: "turn_aborted" })).health.retrying, false);
  assert.equal(parse(...rows, start).health.toolFailures, 0);
  assert.equal(parse(start, event("event_msg", { type: "turn_failed" })).health.state, "error");
});

test("context pressure uses the latest reported input, not total usage", () => {
  const tokens = event("event_msg", { type: "token_count", info: { last_token_usage: { input_tokens: 900 }, total_token_usage: { input_tokens: 99999 }, model_context_window: 1000 } });
  assert.equal(parse(start, tokens).health.state, "watch");
  assert.equal(parse(start, tokens, start).health.state, "healthy");
  assert.equal(parse(start, tokens, start).contextUsed, null);
});

test("retries stay at their desks while disconnected agents wait for a signal", () => {
  const a = officePose("working", 0, 0, 6, true), b = officePose("working", 3, 0, 6, true);
  assert.equal(a.walking, false); assert.equal(a.sitting, true);
  assert.notEqual(a.x, b.x);
  assert.equal(officePose("offline", 0, 0, 6, true).walking, false);
  assert.equal(officePose("working", 0, 0, 6, false).sitting, true);
});

test("health metadata is optional and imported counts are validated", () => {
  const agent = { id: "one", name: "Session", harness: "Codex", model: null, task: null, status: "working", contextUsed: null, contextWindow: null, updatedAt: new Date(now).toISOString(), health: parse(start).health };
  assert.equal(parseOfficeSnapshot(JSON.stringify({ version: 1, agents: [agent] })).agents[0].health.state, "healthy");
  agent.health.retries = -1;
  assert.throws(() => parseOfficeSnapshot(JSON.stringify({ version: 1, agents: [agent] })), /Run health/);
});
