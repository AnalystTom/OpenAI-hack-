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

const DESK_COLUMNS = [-5.8, -2.1, 1.6, -9.5, -13.2, -16.9, -20.6, -24.3, -28, -31.7];
export const DESKS = [
  ...DESK_COLUMNS.flatMap((x) => [-4.4, 3.6].map((z) => ({ x, z }))),
  ...[10.6, 17.6, 24.6].flatMap((z) => DESK_COLUMNS.map((x) => ({ x, z }))),
];
export function officeLayout(total: number) {
  const desks = DESKS.slice(0, Math.max(12, Math.min(50, total)));
  const left = Math.min(-10.5, ...desks.map((desk) => desk.x * 1.15 - 2));
  const bottom = Math.max(8, 7.8 + Math.floor(Math.max(0, total - 1) / 6) * 2, ...desks.map((desk) => desk.z * 1.15 + 3));
  const carpetLeft = Math.min(...desks.map((desk) => desk.x)) * 1.15 - 0.6;
  const carpetRight = Math.max(...desks.map((desk) => desk.x)) * 1.15 + 1.8;
  const carpet = { x: (carpetLeft + carpetRight) / 2, z: 0.1, width: carpetRight - carpetLeft, depth: 3.7 };
  return { desks, carpet, width: 10.5 - left, depth: bottom + 8, x: (left + 10.5) / 2, z: (bottom - 8) / 2 };
}
// The GLB chair faces +Z; turn it toward the desk at -Z. Offsets include its off-centre pivot.
export const CHAIR_PLACEMENT = { x: 0.8, z: -0.09, facing: 180 };
export const SEAT_PLACEMENT = { x: 0.9, z: 0.65, y: 0.27, facing: Math.PI };
/** Stable random-looking appearances, independent of which model runs the session. */
export function agentCharacter(id: string): CharacterKind {
  const choices: CharacterKind[] = ["blue-dot", "frog-dot", "yellow-dot", "pink-dot", "purple-dot", "lovable"];
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return choices[(hash >>> 0) % choices.length];
}
/** Keep the shared walking animation on the central carpet between desks. */
function walkingPose(index: number, time: number, total: number) {
  const { carpet } = officeLayout(total);
  const radiusX = carpet.width / 2 - 1;
  const radiusZ = carpet.depth / 2 - 0.8;
  const angle = time * (1.2 / Math.max(radiusX, radiusZ)) + index / Math.max(1, total) * Math.PI * 2;
  return {
    x: carpet.x + Math.cos(angle) * radiusX,
    z: carpet.z + Math.sin(angle) * radiusZ,
    y: 0.1,
    facing: Math.atan2(-radiusX * Math.sin(angle), radiusZ * Math.cos(angle)),
    walking: true,
    sitting: false,
  };
}
export function officePose(
  status: AgentStatus | "preview",
  index: number,
  time: number,
  total: number,
  retrying = false,
  interaction?: { slot: number; side: "from" | "to" },
) {
  if (status === "working" && retrying) return walkingPose(index, time, total);
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
  // Movement is visual only; resting/unconfirmed session statuses stay unchanged.
  return walkingPose(index, time, total);
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
