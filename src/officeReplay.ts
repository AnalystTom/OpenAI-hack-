import type { OfficeAgent } from "./types";
import { mergeOfficeAgents } from "./officeStore.ts";

export interface OfficeReplay {
  agents: OfficeAgent[];
  durationMs: number;
  startedAt?: Record<string, number>;
}
/** New arrivals start now; the recordings already in the room keep their clock. */
export function appendOfficeReplay(replay: OfficeReplay, incoming: OfficeAgent[], elapsed: number): OfficeReplay {
  const agents = mergeOfficeAgents(replay.agents, incoming);
  const startedAt = { ...replay.startedAt };
  for (const agent of incoming) {
    const previous = replay.agents.find((a) => a.id === agent.id);
    if (!previous || Date.parse(agent.updatedAt) > Date.parse(previous.updatedAt)) startedAt[agent.id] = elapsed;
  }
  const durationMs = Math.max(replay.durationMs, ...agents.map((a) =>
    (startedAt[a.id] ?? 0) + (createOfficeReplay([a])?.durationMs ?? 0),
  ));
  return { ...replay, agents, startedAt, durationMs };
}
export function agentActivityLabel(agent: OfficeAgent): string | undefined {
  if (agent.playback?.state === "finished") return "Task wrapped up";
  if (agent.status !== "working") return undefined;
  if (agent.health?.retrying) return "Retrying a failed step";
  const activity = agent.playback?.label ?? agent.activityLabel;
  if (activity && activity !== "Task started" && !/^Using\b/.test(activity)) return activity;
  const task = agent.task ?? agent.name;
  const verbs: Record<string, string> = { Review: "Reviewing", Audit: "Auditing", Write: "Writing", Check: "Checking", Fix: "Fixing", Plan: "Planning", Design: "Designing", Add: "Adding" };
  const label = task.replace(/^(Review|Audit|Write|Check|Fix|Plan|Design|Add)\b/, (verb) => verbs[verb]);
  return label.length > 42 ? `${label.slice(0, 39).trimEnd()}…` : label;
}
export function createOfficeReplay(agents: OfficeAgent[]): OfficeReplay | null {
  const durations = agents.map((a) =>
    a.history && a.history.length > 1
      ? Date.parse(a.history.at(-1)!.at) - Date.parse(a.history[0].at)
      : 0,
  );
  const durationMs = Math.max(0, ...durations);
  return durationMs > 0
    ? { agents: structuredClone(agents), durationMs }
    : null;
}
/** One elapsed clock; preserve each recording's duration and event spacing. */
export function replayOffice(
  replay: OfficeReplay,
  elapsedMs: number,
): OfficeAgent[] {
  return replay.agents.map((agent) => {
    const history = agent.history;
    if (!history?.length)
      return {
        ...agent,
        status: "unknown",
        health: undefined,
        cost: undefined,
        contextUsed: null,
        contextWindow: null,
      };
    const start = Date.parse(history[0].at);
    const end = Date.parse(history.at(-1)!.at);
    const elapsed = Math.max(0, elapsedMs - (replay.startedAt?.[agent.id] ?? 0));
    const at = start + elapsed;
    const event =
      history.filter((event) => Date.parse(event.at) <= at).at(-1) ??
      history[0];
    return {
      ...agent,
      status: event.status,
      health: undefined,
      cost: undefined,
      playback: { state: at >= end ? "finished" : "playing", label: event.label },
      updatedAt: new Date(
        Math.min(at, Date.parse(history.at(-1)!.at)),
      ).toISOString(),
      contextUsed: null,
      contextWindow: null,
    };
  });
}
export function officeSummary(
  agents: OfficeAgent[],
  recorded: boolean,
): string {
  if (!agents.length)
    return "The office is empty. Import your agents to get started.";
  const working = agents.filter((a) => a.status === "working").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const attention = agents.filter((a) => a.status === "error" || a.status === "blocked").length;
  const unknown = agents.length - working - idle - attention;
  const prefix = recorded ? "Replay · " : "";
  if (attention) return `${prefix}Plot twist: ${attention} ${attention === 1 ? "agent needs" : "agents need"} help. ${working} working; ${idle} waiting${unknown ? `; ${unknown} unconfirmed` : ""}.`;
  const retrying = agents.filter((a) => a.status === "working" && a.health?.retrying).length;
  if (retrying) return `${prefix}${retrying} ${retrying === 1 ? "agent is" : "agents are"} taking another lap: retrying a failed step. ${working} working; ${idle} waiting${unknown ? `; ${unknown} unconfirmed` : ""}.`;
  if (unknown) return `${prefix}${working} ${working === 1 ? "agent is" : "agents are"} working; ${idle} waiting; ${unknown} unconfirmed. Even tiny coworkers need a signal.`;
  if (!working) return `${prefix}Coffee-break energy. ${idle} ${idle === 1 ? "agent is" : "agents are"} taking it easy, waiting for a task.`;
  if (!idle) return `${prefix}All hands on keyboards: ${working} ${working === 1 ? "agent is" : "agents are"} working. Zero meetings required.`;
  return `${prefix}${working} ${working === 1 ? "agent is" : "agents are"} keeping the office moving; ${idle} taking it easy. A very small work-life balance.`;
}
export function replayClockLabel(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
