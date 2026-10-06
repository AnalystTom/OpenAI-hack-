import type { AgentStatus, CharacterKind } from "./types";

export const DESKS = [-5.8, -2.1, 1.6].flatMap((x) =>
  [-4.4, 3.6].map((z) => ({ x, z })),
);
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
      x: (desk.x + 0.5) * 1.15,
      z: (desk.z + 1.35) * 1.15,
      y: 0.4,
      facing: Math.PI,
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
