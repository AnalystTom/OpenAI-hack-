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
export interface RunHealth {
  state: "healthy" | "watch" | "error" | "unknown";
  retrying: boolean;
  toolFailures: number;
  retries: number;
  recoveredRetries: number;
}
export interface OfficeAgent {
  id: string;
  name: string;
  /** Name supplied by the uploader; not a verified account identity. */
  ownerName?: string;
  harness: string;
  model: string | null;
  status: AgentStatus;
  task: string | null;
  contextUsed: number | null;
  contextWindow: number | null;
  updatedAt: string;
  /** When the source connection was observed lost; separate from task activity. */
  disconnectedAt?: string;
  character?: CharacterKind;
  sourceUrl?: string;
  history?: RecordedActivity[];
  activityLabel?: string | null;
  health?: RunHealth;
  cost?: { estimatedUSD: number | null; observedRequests: number; unpricedRequests: number; assumedModelRequests: number };
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
