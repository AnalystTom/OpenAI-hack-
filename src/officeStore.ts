import type { OfficeAgent } from "./types";
import { parseOfficeSnapshot } from "./snapshot.ts";

export const OFFICE_STORAGE_KEY = "dots-office-v1";
export const ENTERED_STORAGE_KEY = "dots-office-entered";

/** Preserve existing seats/order; newer source events update the same session. */
export function mergeOfficeAgents(current: OfficeAgent[], incoming: OfficeAgent[]) {
  const agents = new Map(current.map((agent) => [agent.id, agent]));
  for (const agent of incoming) {
    const previous = agents.get(agent.id);
    if (!previous || Date.parse(agent.updatedAt) >= Date.parse(previous.updatedAt))
      agents.set(agent.id, agent);
  }
  if (agents.size > 50) throw new Error("This world supports 50 imported agents. Choose fewer new sessions.");
  return [...agents.values()];
}

/** Store only source metadata, never uploaded extras or transient playback state. */
export function serializeOffice(agents: OfficeAgent[]) {
  return JSON.stringify({ version: 1, agents: agents.map((a) => ({
    id: a.id, name: a.name, harness: a.harness, model: a.model,
    status: a.status, task: a.task, activityLabel: a.activityLabel, contextUsed: a.contextUsed,
    contextWindow: a.contextWindow, updatedAt: a.updatedAt, character: a.character,
    health: a.health, cost: a.cost,
    history: a.history?.map(({ at, status, label }) => ({ at, status, label })),
  })) });
}

export function readSavedOffice(storage: Pick<Storage, "getItem">) {
  try {
    const text = storage.getItem(OFFICE_STORAGE_KEY);
    return { agents: text ? parseOfficeSnapshot(text).agents : [], error: "" };
  } catch {
    return { agents: [], error: "Your saved office could not be read. It has not been overwritten; you can re-import a snapshot." };
  }
}
