import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSessionEvents } from "../server/codex-sessions.mjs";
import { parseOfficeSnapshot } from "../src/snapshot.ts";
const event = (type, payload) => JSON.stringify({ timestamp: "2026-10-06T12:00:00Z", type, payload });
const model = (name) => event("turn_context", { model: name });
const tokens = (input, cached, output, total = input + output) => event("event_msg", { type: "token_count", info: { last_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output, reasoning_output_tokens: output }, total_token_usage: { total_tokens: total } } });
const parse = (...rows) => parseSessionEvents(rows.join("\n"));
test("API estimate discounts cached input and does not double-count reasoning or duplicate usage", () => {
  const usage = tokens(1000, 800, 100);
  const cost = parse(model("gpt-6.1-sol"), usage, usage).cost;
  assert.ok(Math.abs(cost.estimatedUSD - 0.00148) < 1e-10);
  assert.equal(cost.observedRequests, 1);
});
test("each request uses its reported model and input-based long-context tier", () => {
  const cost = parse(model("gpt-6-astra"), tokens(300000, 200000, 1000), model("gpt-6.1-sol"), tokens(1000, 0, 100, 302100)).cost;
  assert.ok(Math.abs(cost.estimatedUSD - 2.478) < 1e-10);
  assert.equal(cost.observedRequests, 2);
});
test("missing model, unknown prices and incomplete tokens remain unavailable", () => {
  assert.equal(parse(tokens(100, 0, 10)).cost.estimatedUSD, null);
  assert.equal(parse(model("unknown"), tokens(100, 0, 10)).cost.estimatedUSD, null);
  assert.equal(parse(model("gpt-6.1-sol"), tokens(100, 200, 10)).cost.estimatedUSD, null);
  assert.equal(parse(model("gpt-6.1-sol")).cost.estimatedUSD, null);
  const agent = { id: "one", name: "Session", harness: "Codex", model: null, task: null, status: "idle", contextUsed: null, contextWindow: null, updatedAt: "2026-10-06T12:00:00Z", cost: { estimatedUSD: -1, observedRequests: 1, unpricedRequests: 0, assumedModelRequests: 0 } };
  assert.throws(() => parseOfficeSnapshot(JSON.stringify({ version: 1, agents: [agent] })), /Cost/);
});

test("partial costs declare unpriced requests and include observed cache writes", () => {
  const writes = event("event_msg", { type: "token_count", info: { last_token_usage: { input_tokens: 1000, cached_input_tokens: 0, cache_write_input_tokens: 800, output_tokens: 100 }, total_token_usage: { total_tokens: 1100 } } });
  const cost = parse(model("gpt-6.1-sol"), writes, model("unpriced-model"), tokens(1000, 0, 100, 2200)).cost;
  assert.ok(Math.abs(cost.estimatedUSD - 0.0034) < 1e-10);
  assert.equal(cost.unpricedRequests, 1);
  assert.equal(cost.observedRequests, 2);
});

test("current-model fallback is explicitly marked as assumed, never a verified historical price", () => {
  const cost = parseSessionEvents(tokens(1000, 800, 100), Date.now(), "gpt-6.1-sol").cost;
  assert.ok(Math.abs(cost.estimatedUSD - 0.00148) < 1e-10);
  assert.equal(cost.assumedModelRequests, 1);
  assert.equal(parse(model("gpt-6.1-sol"), tokens(1000, 800, 100)).cost.assumedModelRequests, 0);
});
