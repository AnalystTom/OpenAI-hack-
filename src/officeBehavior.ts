import type { AgentInteraction, AgentStatus, CharacterKind, OfficeAgent } from "./types";

export interface LiveInteraction extends AgentInteraction {
  slot: number;
}

/** Recent recorded links between two sessions that are both still running. */
export function liveInteractions(
  agents: OfficeAgent[],
  recorded: AgentInteraction[],
  now = Date.now(),
): LiveInteraction[] {
  const working = new Set(agents.filter((agent) => agent.status === "working").map((agent) => agent.id));
  const occupied = new Set<string>();
  const result: LiveInteraction[] = [];
  for (const link of [...recorded].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const age = now - Date.parse(link.at);
    if (!Number.isFinite(age) || age < -5000 || age > 90000 ||
      !working.has(link.fromId) || !working.has(link.toId) ||
      link.fromId === link.toId || occupied.has(link.fromId) || occupied.has(link.toId)) continue;
    occupied.add(link.fromId);
    occupied.add(link.toId);
    result.push({ ...link, slot: result.length });
    if (result.length === 2) break;
  }
  return result;
}

export const DESKS = [-5.8, -2.1, 1.6].flatMap((x) =>
  [-4.4, 3.6].map((z) => ({ x, z })),
);
// The GLB chair faces +Z; turn it toward the desk at -Z. Offsets include its off-centre pivot.
export const CHAIR_PLACEMENT = { x: 0.8, z: -0.09, facing: 180 };
export const SEAT_PLACEMENT = { x: 0.9, z: 0.65, y: 0.27, facing: Math.PI };
export function agentCharacter(
  id: string,
  model: string | null,
  harness: string,
): CharacterKind {
  if (harness.toLowerCase() === "lovable") return "lovable";
  if (model?.includes("astra")) return "yellow-dot";
  if (model?.includes("luna")) return "purple-dot";
  const choices: CharacterKind[] = ["blue-dot", "frog-dot", "pink-dot"];
  return choices[
    [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % choices.length
  ];
}
export function officePose(
  status: AgentStatus | "preview",
  index: number,
  time: number,
  total: number,
  retrying = false,
  interaction?: { slot: number; side: "from" | "to" },
) {
  if (status === "working" && retrying) {
    const angle = time * 1.4 + index;
    const center = DESKS[index % DESKS.length];
    return { x: center.x * 1.15 + Math.cos(angle) * 0.65,
      z: 0.55 + Math.sin(angle) * 0.65, y: 0.1,
      facing: Math.atan2(-Math.sin(angle), Math.cos(angle)),
      walking: true, sitting: false };
  }
  if (status === "working" && interaction) {
    const anchor = interaction.slot === 0 ? { x: 3.6, z: 2.5 } : { x: -4.2, z: 2.5 };
    const side = interaction.side === "from" ? -1 : 1;
    return {
      x: anchor.x + side * 1.05 + Math.sin(time * 2.5 + index) * 0.1,
      z: anchor.z + Math.cos(time * 2.5 + index) * 0.12,
      y: 0.1 + Math.abs(Math.sin(time * 3 + index)) * 0.09,
      facing: side < 0 ? Math.PI / 2 : -Math.PI / 2,
      walking: true,
      sitting: false,
    };
  }
  if (status === "working") {
    const desk = DESKS[index % DESKS.length];
    return {
      x: (desk.x + SEAT_PLACEMENT.x) * 1.15,
      z: (desk.z + SEAT_PLACEMENT.z) * 1.15,
      y: SEAT_PLACEMENT.y,
      facing: SEAT_PLACEMENT.facing,
      walking: false,
      sitting: true,
    };
  }
  if (status === "idle") {
    // Resting in the lounge is visibly different from active work or play.
    return {
      x: 4.9 + (index % 3) * 1.6,
      z: -2.6 + Math.floor(index / 3) * 1.45,
      y: 0.1,
      facing: 0,
      walking: false,
      sitting: false,
    };
  }
  if (status === "preview") {
    // Character previews have no associated session activity.
    const cycle = 30;
    const phase = time % cycle;
    const travel =
      (Math.min(phase, 24) / 24) * Math.PI * 2 +
      (index / Math.max(1, total)) * Math.PI * 2;
    return {
      x: Math.cos(travel) * 6.7 - 1.6,
      z: Math.sin(travel) * 1.18 + 0.55,
      y: 0.1,
      facing: Math.atan2(-6.7 * Math.sin(travel), 1.18 * Math.cos(travel)),
      walking: phase < 24,
      sitting: false,
    };
  }
  // No walking/typing for missing source state, errors, or disconnected sessions.
  return {
    x: -7.5 + (index % 6) * 2.4,
    z: 6.8,
    y: 0.1,
    facing: 0,
    walking: false,
    sitting: false,
  };
}

export const STATUS_LABELS: Record<AgentStatus | "preview", string> = {
  working: "Working at desk",
  idle: "Waiting for a task",
  offline: "Source disconnected",
  unknown: "Status not confirmed",
  blocked: "Needs your help",
  error: "Task error",
  preview: "Character preview",
};
