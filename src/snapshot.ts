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
  if ("interactions" in value && value.interactions !== undefined) {
    if (!Array.isArray(value.interactions) || value.interactions.length > 100)
      throw new Error("A snapshot supports up to 100 recorded session links.");
    for (const link of value.interactions) {
      if (
        !link ||
        typeof link !== "object" ||
        typeof link.fromId !== "string" ||
        typeof link.toId !== "string" ||
        !ids.has(link.fromId) ||
        !ids.has(link.toId) ||
        link.fromId === link.toId ||
        !["delegation", "message"].includes(link.kind) ||
        typeof link.at !== "string" ||
        !Number.isFinite(Date.parse(link.at))
      )
        throw new Error("Session links need two known agents, a kind, and a timestamp.");
    }
  }
  return value as OfficeSnapshot;
}
