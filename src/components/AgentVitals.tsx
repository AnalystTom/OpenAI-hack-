import type { OfficeAgent } from "../types";
import { ContextUsage } from "./ContextUsage";
import "./agent-vitals.css";

export function AgentVitals({ agent }: { agent: OfficeAgent }) {
  const health = agent.health;
  const state = agent.status === "offline" || agent.status === "unknown" ? "unknown" : health?.state ?? "unknown";
  const label = state === "unknown" ? "Not reported" : health?.retrying ? "Retrying"
    : { healthy: "No issues seen", watch: "Issue observed", error: "Needs attention" }[state];
  const cost = agent.cost;
  const amount = cost?.estimatedUSD;
  return <section className="agent-vitals" aria-label="Run health and usage">
    <div className="vitals-heading"><span>Run health</span><span className="vitals-health" data-state={state}>{label}</span></div>
    <ul className="vitals-counts" aria-label="Latest observed turn">
      <li><strong>{health?.toolFailures ?? "—"}</strong><span>Failures</span></li>
      <li><strong>{health?.retries ?? "—"}</strong><span>Retries</span></li>
      <li><strong>{health?.recoveredRetries ?? "—"}</strong><span>Recovered</span></li>
    </ul>
    <div className="vitals-cost"><span>Observed cost <small>estimate</small></span>
      <strong>{amount == null ? "Unavailable" : new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4,
      }).format(amount)}</strong>
    </div>
    {cost && <details className="vitals-estimate"><summary>{amount === null ? "Why unavailable?"
      : `${cost.unpricedRequests ? "Partial · " : ""}${cost.assumedModelRequests ? "Approximate · " : ""}Estimate details`}</summary>
      <p>{amount === null ? "The model or recorded usage has no verified rate available." : <>
        Standard API equivalent. {cost.observedRequests - cost.unpricedRequests} of {cost.observedRequests} observed requests priced.
        {cost.assumedModelRequests > 0 && <> {cost.assumedModelRequests} use the current model rate because their model checkpoint is missing.</>}
        {" "}Recent log data; excludes tool fees and subscription billing.
      </>}</p>
    </details>}
    <ContextUsage used={agent.contextUsed} capacity={agent.contextWindow} />
  </section>;
}
