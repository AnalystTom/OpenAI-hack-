import type { AgentStatus, CharacterKind } from "./types";

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
) {
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
  if (status === "idle" || status === "preview") {
    // A six-second pause each lap is visual idle behaviour, never source activity.
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
