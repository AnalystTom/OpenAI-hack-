import "./context-usage.css";

export function ContextUsage({ used, capacity }: { used: number | null; capacity: number | null }) {
  if (used === null || capacity === null || capacity <= 0) return <div className="context-usage"><span>Context used: Not reported</span></div>;
  const fraction = used / capacity;
  const percent = Math.round(fraction * 100);
  const level = fraction >= 0.9 ? "critical" : fraction >= 0.8 ? "warning" : "normal";
  return <div className="context-usage" data-level={level}>
    <div className="context-heading"><span>Context used</span><b>{percent}% used</b></div>
    <progress aria-label="Last reported context used" aria-valuetext={`${percent}% used: ${used.toLocaleString()} of ${capacity.toLocaleString()} tokens`}
      value={Math.min(used, capacity)} max={capacity} />
    <small>{used.toLocaleString()} / {capacity.toLocaleString()} tokens{level !== "normal" && <strong>{level === "critical" ? "Near capacity" : "High usage"}</strong>}</small>
  </div>;
}
