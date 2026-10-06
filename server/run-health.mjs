import { createHash } from "node:crypto";

// Inspect machine outcomes locally. Never return arguments, output, or signatures.
function outcome(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === "string") {
    try { return outcome(JSON.parse(value), depth + 1); } catch { /* shell envelope */ }
    const match = value.match(/^(?:Process exited with code|Exit code):?\s*(-?\d+)\s*$/m);
    return match ? Number(match[1]) !== 0 : null;
  }
  if (!value || typeof value !== "object") return null;
  if (value.isError === true || value.is_error === true) return true;
  if (Number.isInteger(value.exit_code)) return value.exit_code !== 0;
  const items = Array.isArray(value) ? value : [value.output, value.content, value.result, value.text];
  const outcomes = items.map((item) => outcome(item, depth + 1));
  return outcomes.includes(true) ? true : outcomes.includes(false) ? false : null;
}

export function runHealthTracker() {
  let toolFailures = 0, retries = 0, recoveredRetries = 0, unclassifiedFailures = 0, turnFailed = false;
  const calls = new Map(), failed = new Set(), retrying = new Set();
  return {
    observe(event) {
      const p = event.payload;
      if (event.type === "event_msg") {
        if (p.type === "task_started") {
          toolFailures = retries = recoveredRetries = unclassifiedFailures = 0; turnFailed = false;
          calls.clear(); failed.clear(); retrying.clear();
        }
        if (["task_complete", "turn_aborted", "error", "turn_failed"].includes(p.type)) {
          retrying.clear(); calls.clear();
          turnFailed = ["error", "turn_failed"].includes(p.type);
        }
      }
      if (event.type !== "response_item") return;
      if (["function_call", "custom_tool_call"].includes(p.type) && typeof p.call_id === "string") {
        let input = p.arguments ?? p.input;
        // Missing input is insufficient evidence to identify a retry.
        if (typeof input !== "string" || typeof p.name !== "string") return;
        const signature = createHash("sha256").update(p.name + "\0" + input).digest("hex");
        calls.set(p.call_id, signature);
        if (failed.has(signature)) { retrying.add(p.call_id); retries++; }
      }
      if (["function_call_output", "custom_tool_call_output"].includes(p.type)) {
        const signature = calls.get(p.call_id), result = outcome(p.output);
        if (result === true) { toolFailures++; if (signature) failed.add(signature); else unclassifiedFailures++; }
        if (result === false && signature) {
          if (retrying.has(p.call_id)) recoveredRetries++;
          failed.delete(signature);
        }
        retrying.delete(p.call_id); calls.delete(p.call_id);
      }
    },
    snapshot(status, contextUsed, contextWindow) {
      const unavailable = status === "unknown" || status === "offline";
      const pressure = contextUsed !== null && contextWindow > 0 && contextUsed / contextWindow >= 0.9;
      return {
        state: unavailable ? "unknown" : turnFailed ? "error" : failed.size || unclassifiedFailures || retrying.size || pressure ? "watch" : "healthy",
        retrying: !unavailable && status === "working" && retrying.size > 0,
        toolFailures, retries, recoveredRetries,
      };
    },
  };
}
