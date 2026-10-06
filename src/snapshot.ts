import type { OfficeSnapshot } from "./types";
export function parseOfficeSnapshot(text: string): OfficeSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("agents" in value) ||
    !Array.isArray(value.agents)
  )
    throw new Error(
      "Choose an office snapshot with version 1 and an agents array.",
    );
  if (value.agents.length > 50)
    throw new Error("This office supports up to 50 agents per snapshot.");
  const ids = new Set<string>();
  for (const a of value.agents) {
    if (
      !a ||
      typeof a !== "object" ||
      typeof a.id !== "string" ||
      !a.id.trim() ||
      typeof a.name !== "string" ||
      !a.name.trim() ||
      typeof a.harness !== "string" ||
      !a.harness.trim() ||
      !["working", "idle", "blocked", "error", "offline", "unknown"].includes(
        a.status,
      ) ||
      typeof a.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(a.updatedAt))
    )
      throw new Error(
        "Each agent needs an id, name, harness, valid status, and updatedAt timestamp.",
      );
    if (a.cost !== undefined) {
      if (!a.cost || (a.cost.estimatedUSD !== null &&
          (typeof a.cost.estimatedUSD !== "number" || !Number.isFinite(a.cost.estimatedUSD) || a.cost.estimatedUSD < 0)) ||
          ![a.cost.observedRequests, a.cost.unpricedRequests].every((n) => Number.isSafeInteger(n) && n >= 0) ||
          a.cost.unpricedRequests > a.cost.observedRequests)
        throw new Error("Cost must be an estimate or null, with an observed request count.");
    }
    if (a.health !== undefined) {
      const h = a.health;
      if (!h || !["healthy", "watch", "error", "unknown"].includes(h.state) ||
          typeof h.retrying !== "boolean" ||
          ![h.toolFailures, h.retries, h.recoveredRetries].every((n) => Number.isSafeInteger(n) && n >= 0) ||
          h.recoveredRetries > h.retries)
        throw new Error("Run health needs a valid state and observed counts.");
    }
    if (a.history !== undefined) {
      if (!Array.isArray(a.history) || a.history.length > 100)
        throw new Error("History must contain at most 100 recorded events.");
      let previous = -Infinity;
      for (const event of a.history) {
        const at = typeof event?.at === "string" ? Date.parse(event.at) : NaN;
        if (
          !Number.isFinite(at) ||
          at < previous ||
          typeof event.label !== "string" ||
          ![
            "working",
            "idle",
            "blocked",
            "error",
            "offline",
            "unknown",
          ].includes(event.status)
        )
          throw new Error(
            "Recorded history must have ordered timestamps, labels, and valid states.",
          );
        previous = at;
      }
    }
    if (ids.has(a.id)) throw new Error("Agent IDs must be unique.");
    ids.add(a.id);
    for (const key of ["model", "task"])
      if (a[key] !== null && typeof a[key] !== "string")
        throw new Error(`${key} must be text or null.`);
    for (const key of ["contextUsed", "contextWindow"])
      if (
        a[key] !== null &&
        (typeof a[key] !== "number" || !Number.isFinite(a[key]) || a[key] < 0)
      )
        throw new Error(`${key} must be a non-negative number or null.`);
    if (a.contextWindow === 0)
      throw new Error("Context window must be greater than zero, or null.");
    if (
      a.character !== undefined &&
      ![
        "blue-dot",
        "frog-dot",
        "yellow-dot",
        "pink-dot",
        "purple-dot",
        "lovable",
      ].includes(a.character)
    )
      throw new Error("Unknown character selection.");
  }
  return value as OfficeSnapshot;
}
