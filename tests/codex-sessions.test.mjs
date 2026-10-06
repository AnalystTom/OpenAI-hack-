import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSessionEvents,
  localRequestAllowed,
} from "../server/codex-sessions.mjs";
const at = "2026-10-06T18:00:00.000Z";
const now = Date.parse(at);
const event = (type, payload, timestamp = at) =>
  JSON.stringify({ type, timestamp, payload });
test("running/completed turns drive working and idle, stale runs stay unknown", () => {
  const start = event("event_msg", { type: "task_started" });
  assert.equal(parseSessionEvents(start, now).status, "working");
  assert.equal(parseSessionEvents(start, now + 300001).status, "unknown");
  const end = event(
    "event_msg",
    {
      type: "task_complete",
      started_at: now / 1000,
      completed_at: now / 1000 + 60,
    },
    new Date(now + 60000).toISOString(),
  );
  const result = parseSessionEvents(start + "\n" + end, now + 60000);
  assert.equal(result.status, "idle");
  assert.equal(result.history.at(-1).status, "idle");
  assert.equal(result.history[0].at, at);
});
test("partial records do not crash; use last input tokens, never accumulated usage", () => {
  const text =
    '{"partial":\n' +
    event("event_msg", {
      type: "token_count",
      info: {
        total_token_usage: { input_tokens: 90000000 },
        last_token_usage: { input_tokens: 100 },
        model_context_window: 1000,
      },
    }) +
    '\n{"unfinished"';
  const result = parseSessionEvents(text, now);
  assert.equal(result.contextUsed, 100);
  assert.equal(result.contextWindow, 1000);
  assert.equal(result.status, "unknown");
});
test("source text and tool arguments never leak into activity history", () => {
  const start = event("event_msg", { type: "task_started" });
  const tool = event(
    "response_item",
    {
      type: "function_call",
      name: "exec_command",
      arguments: "SENSITIVE_TEST_VALUE",
    },
    new Date(now + 1000).toISOString(),
  );
  const end = event(
    "event_msg",
    {
      type: "task_complete",
      started_at: now / 1000,
      completed_at: now / 1000 + 60,
      last_agent_message: "PRIVATE_REPLY",
    },
    new Date(now + 60000).toISOString(),
  );
  assert.ok(
    !JSON.stringify(
      parseSessionEvents([start, tool, end].join("\n"), now + 60000),
    ).match(/SENSITIVE_TEST_VALUE|PRIVATE_REPLY/),
  );
});
test("local endpoint rejects remote clients, cross-origin and DNS rebinding hosts", () => {
  const valid = {
    socket: { remoteAddress: "127.0.0.1" },
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "sec-fetch-site": "same-origin",
    },
  };
  assert.equal(localRequestAllowed(valid), true);
  assert.equal(
    localRequestAllowed({ ...valid, socket: { remoteAddress: "10.0.0.1" } }),
    false,
  );
  assert.equal(
    localRequestAllowed({
      ...valid,
      headers: { ...valid.headers, origin: "https://evil.test" },
    }),
    false,
  );
  assert.equal(
    localRequestAllowed({ ...valid, headers: { host: "evil.test:3000" } }),
    false,
  );
  assert.equal(
    localRequestAllowed({
      ...valid,
      headers: { ...valid.headers, "sec-fetch-site": "cross-site" },
    }),
    false,
  );
});
