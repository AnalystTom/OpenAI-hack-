export type AgentStatus =
  "working" | "idle" | "blocked" | "error" | "offline" | "unknown";
export type CharacterKind =
  | "blue-dot"
  | "frog-dot"
  | "yellow-dot"
  | "pink-dot"
  | "purple-dot"
  | "lovable";
/** Real source data only. Missing telemetry remains null, never estimated. */
export interface RecordedActivity {
  at: string;
  status: AgentStatus;
  label: string;
}
export interface OfficeAgent {
  id: string;
  name: string;
  harness: string;
  model: string | null;
  status: AgentStatus;
  task: string | null;
  contextUsed: number | null;
  contextWindow: number | null;
  updatedAt: string;
  character?: CharacterKind;
  sourceUrl?: string;
  history?: RecordedActivity[];
}
/** A recorded link between two sessions; message contents are never included. */
export interface AgentInteraction {
  fromId: string;
  toId: string;
  at: string;
  kind: "delegation" | "message";
}
export interface OfficeSnapshot {
  version: 1;
  agents: OfficeAgent[];
  interactions?: AgentInteraction[];
}
