import { test } from "node:test";
import assert from "node:assert/strict";
import { toolActivityLabel } from "../server/activity-label.mjs";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseSessionEvents,
  localRequestAllowed,
  readRobotsSessions,
} from "../server/codex-sessions.mjs";
const at = "2026-10-06T18:00:00.000Z";
const now = Date.parse(at);
test("activity descriptions come from identifiable tools and commands", () => {
  assert.equal(toolActivityLabel("exec_command", JSON.stringify({cmd:"npm test"})), "Running tests");
  assert.equal(toolActivityLabel("exec", 'await tools.exec_command({cmd:"npm run build"})'), "Checking the build");
  assert.equal(toolActivityLabel("exec_command", JSON.stringify({cmd:"rg -n task src"})), "Inspecting project files");
  assert.equal(toolActivityLabel("apply_patch", "PRIVATE_FILE_CONTENT"), "Editing project files");
  assert.equal(toolActivityLabel("exec", "unclassified private code"), "Using tools");
});
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
test("local feed connects two selected sessions through recorded delegation and message metadata", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "dots-sessions-"));
  const database = new DatabaseSync(path.join(directory, "state_5.sqlite"));
  try {
    database.exec("CREATE TABLE threads (id TEXT, name TEXT, title TEXT, model TEXT, agent_path TEXT, created_at INTEGER, updated_at INTEGER, rollout_path TEXT, archived INTEGER, cwd TEXT)");
    database.exec("CREATE TABLE thread_spawn_edges (parent_thread_id TEXT, child_thread_id TEXT, status TEXT)");
    const source = path.join(directory, "source.jsonl");
    const target = path.join(directory, "target.jsonl");
    const began = new Date(now - 30000).toISOString();
    const sent = new Date(now - 10000).toISOString();
    await writeFile(source, [
      event("event_msg", { type: "task_started" }, began),
      event("response_item", { type: "function_call", name: "send_message_to_thread", arguments: JSON.stringify({ threadId: "target-session", prompt: "PRIVATE_MESSAGE" }) }, sent),
      event("response_item", { type: "function_call", name: "exec", arguments: "const result = await tools.mcp__codex_app__send_message_to_thread({threadId:'target-session',prompt:'PRIVATE_NESTED'});" }, new Date(now - 9000).toISOString()),
      event("response_item", { type: "function_call", name: "send_message", arguments: JSON.stringify({ target: "/root/target", message: "PRIVATE_DIRECT" }) }, new Date(now - 8000).toISOString()),
    ].join("\n"));
    await writeFile(target, event("event_msg", { type: "task_started" }, began));
    const insert = database.prepare("INSERT INTO threads VALUES (?,?,?,?,?,?,?,?,?,?)");
    insert.run("source-session", "Source", "", "gpt-6", null, (now - 40000) / 1000, (now - 10000) / 1000, source, 0, "/sample");
    insert.run("target-session", "Target", "", "gpt-6", "/root/target", (now - 20000) / 1000, (now - 10000) / 1000, target, 0, "/sample");
    database.prepare("INSERT INTO thread_spawn_edges VALUES (?,?,?)").run("source-session", "target-session", "open");
    database.close();
    const snapshot = await readRobotsSessions({ codexHome: directory, project: "/sample", now });
    assert.deepEqual(snapshot.agents.map((agent) => agent.status), ["working", "working"]);
    assert.deepEqual(snapshot.interactions.map((link) => link.kind).sort(), ["delegation", "message", "message", "message"]);
    assert.ok(!/PRIVATE_MESSAGE|PRIVATE_NESTED|PRIVATE_DIRECT/.test(JSON.stringify(snapshot)));
  } finally {
    try { database.close(); } catch { /* Already closed after writing. */ }
    await rm(directory, { recursive: true, force: true });
  }
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
