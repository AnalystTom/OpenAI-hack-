import "./context-usage.css";

export function ContextUsage({ used, capacity }: { used: number | null; capacity: number | null }) {
  if (used === null || capacity === null || capacity <= 0) return <span>Not reported</span>;
  const percent = Math.round(used / capacity * 100);
  return <div className="context-usage">
    <span>{percent}% used</span>
    <progress aria-label="Last reported context used" aria-valuetext={`${percent}% used: ${used.toLocaleString()} of ${capacity.toLocaleString()} tokens`}
      value={Math.min(used, capacity)} max={capacity} />
    <small>{used.toLocaleString()} / {capacity.toLocaleString()} tokens</small>
  </div>;
}
