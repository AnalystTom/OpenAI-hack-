import type { AgentInteraction, OfficeAgent } from "./types";
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
export function serializeOffice(agents: OfficeAgent[], interactions?: AgentInteraction[]) {
  return JSON.stringify({ version: 1, agents: agents.map((a) => ({
    id: a.id, name: a.name, harness: a.harness, model: a.model,
    status: a.status, task: a.task, activityLabel: a.activityLabel, contextUsed: a.contextUsed,
    contextWindow: a.contextWindow, updatedAt: a.updatedAt, character: a.character,
    health: a.health && { state: a.health.state, retrying: a.health.retrying, toolFailures: a.health.toolFailures, retries: a.health.retries, recoveredRetries: a.health.recoveredRetries },
    cost: a.cost && { estimatedUSD: a.cost.estimatedUSD, observedRequests: a.cost.observedRequests, unpricedRequests: a.cost.unpricedRequests, assumedModelRequests: a.cost.assumedModelRequests },
    history: a.history?.map(({ at, status, label }) => ({ at, status, label })),
  })), ...(interactions ? { interactions: interactions.map(({ fromId, toId, at, kind }) => ({ fromId, toId, at, kind })) } : {}) });
}

export function readSavedOffice(storage: Pick<Storage, "getItem">) {
  try {
    const text = storage.getItem(OFFICE_STORAGE_KEY);
    const snapshot = text ? parseOfficeSnapshot(text) : null;
    return { agents: snapshot?.agents ?? [], interactions: snapshot?.interactions ?? [], error: "" };
  } catch {
    return { agents: [], interactions: [], error: "Your saved office could not be read. It has not been overwritten; you can re-import a snapshot." };
  }
}
