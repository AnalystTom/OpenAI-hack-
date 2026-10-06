import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, HeartPulse, X } from "lucide-react";
import "./first-aid.css";

type DoctorStatus = "ok" | "warning" | "fail" | "unknown" | "skipped";
type Report = {
  checkedAt: string; version: string; status: DoctorStatus;
  checks: { id: string; category: string; status: DoctorStatus; summary: string; explanation: string | null; remediation: string | null }[];
};
const labels: Record<DoctorStatus, string> = { ok: "Passed", warning: "Warning", fail: "Failed", unknown: "Unknown", skipped: "Skipped" };

export function FirstAidPanel({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const close = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    close.current?.focus();
    return () => { active.current = false; };
  }, []);
  async function checkSetup() {
    if (running) return;
    setRunning(true); setError("");
    try {
      const response = await fetch("/api/local-codex/doctor", { method: "POST" });
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error("Open the local development office to run Codex diagnostics.");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Diagnostics are unavailable.");
      if (active.current) setReport(body);
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Could not reach the local diagnostic service.");
    } finally { if (active.current) setRunning(false); }
  }
  const issues = report?.checks.filter((c) => c.status === "fail" || c.status === "warning") ?? [];
  const other = report?.checks.filter((c) => c.status !== "fail" && c.status !== "warning") ?? [];
  return <section className="first-aid-panel" aria-labelledby="first-aid-title" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
    <button ref={close} className="close" aria-label="Close first-aid station" onClick={onClose}><X size={16} /></button>
    <span className="first-aid-kicker"><HeartPulse size={14} /> THIS COMPUTER</span>
    <h2 id="first-aid-title">First-aid station</h2>
    <p className="first-aid-intro">Check the Codex setup shared by your local agents.</p>
    <button className="doctor-run" onClick={checkSetup} disabled={running}>
      <HeartPulse size={15} /> {running ? "Checking setup…" : report ? "Run check again" : "Run setup check"}
    </button>
    <p className="doctor-scope">Checks installation, configuration, authentication and runtime. Run health stays separate.</p>
    <div role="status" aria-live="polite">{running && <p className="doctor-progress">Codex doctor is running. This may take up to 45 seconds.</p>}</div>
    {error && <p className="doctor-error" role="alert">{error}</p>}
    {report && <div className="doctor-report" aria-busy={running}>
      <div className="doctor-result" data-status={report.status}>
        <strong>{report.status === "ok" ? "Setup checks passed" : report.status === "fail" ? "Setup needs attention" : "Review setup findings"}</strong>
        <span>{report.checks.filter((c) => c.status === "ok").length} passed · {issues.length} {issues.length === 1 ? "finding" : "findings"}</span>
      </div>
      <small className="doctor-checked">{running ? "Previous check" : "Checked"} {new Date(report.checkedAt).toLocaleTimeString()} · Codex {report.version}</small>
      <p className="doctor-scope">Findings reflect this diagnostic process. Network restrictions and a non-interactive terminal can affect checks.</p>
      {issues.length > 0 && <ul className="doctor-checks">{issues.map((c) => <li key={c.id} data-status={c.status}>
        <div><CircleAlert size={14} /><b>{c.category}</b><span>{labels[c.status]}</span></div>
        <p>{c.summary}</p>
        {c.id === "terminal.env" && c.status === "warning" && <small>Expected for a check run by this website. This affects terminal formatting.</small>}
        {c.explanation && <small>{c.explanation}</small>}{c.remediation && <small>{c.remediation}</small>}
      </li>)}</ul>}
      {other.length > 0 && <details className="doctor-passed"><summary>Other checks ({other.length})</summary>
        <ul className="doctor-checks">{other.map((c) => <li key={c.id} data-status={c.status}>
          <div>{c.status === "ok" ? <Check size={14} /> : <CircleAlert size={14} />}<b>{c.category}</b><span>{labels[c.status]}</span></div><p>{c.summary}</p>
        </li>)}</ul>
      </details>}
    </div>}
  </section>;
}
