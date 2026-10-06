import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, FileUp, Play, RefreshCw, X } from "lucide-react";
import type { AgentInteraction, OfficeAgent, OfficeSnapshot } from "../../types";
import { parseOfficeSnapshot } from "../../snapshot";
import { importPrompt, type ImportPairing } from "../../integrations/codex/importPrompt";
import "./welcome.css";

export default function Welcome({ onImport, onExplore, existingCount = 0 }: {
  onImport: (agents: OfficeAgent[], interactions?: AgentInteraction[]) => void;
  onExplore: () => void;
  existingCount?: number;
}) {
  const [project, setProject] = useState("");
  const [pairing, setPairing] = useState<ImportPairing | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState("Preparing your import…");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const promptDetails = useRef<HTMLDetailsElement>(null);
  const received = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const receive = (data: OfficeSnapshot) => {
    received.current = true;
    setSnapshot(data);
    setSelected(new Set(data.agents.map((a) => a.id)));
    setError("");
  };

  useEffect(() => {
    // Static hosting supports the exact same snapshot through file import.
    // The local upload capability is never presented as a hosted service.
    if (!import.meta.env.DEV) {
      setConnection("Save the snapshot in Codex, then import the file below.");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let active: ImportPairing | null = null;
    received.current = false;
    const remove = (value: ImportPairing) => fetch(`/api/office-import/${value.id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${value.readToken}` }, keepalive: true,
    }).catch(() => {});
    setPairing(null);
    setCopied(false);
    setConnection("Preparing your import…");
    async function poll(value: ImportPairing) {
      if (cancelled || received.current) return;
      try {
        const response = await fetch(`/api/office-import/${value.id}`, {
          headers: { Authorization: `Bearer ${value.readToken}` }, cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (cancelled || received.current) return;
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Upload connection unavailable.");
        if (data.snapshot) {
          receive(parseOfficeSnapshot(JSON.stringify(data.snapshot)));
          setConnection("Snapshot received. Choose the sessions to bring into your office.");
          return;
        }
        timer = setTimeout(() => poll(value), 1500);
      } catch (e) {
        if (cancelled) return;
        setPairing(null);
        setConnection(e instanceof Error ? e.message : "Upload connection lost. Import the snapshot file instead.");
      }
    }
    async function start() {
      try {
        const response = await fetch("/api/office-import/", { method: "POST", signal: AbortSignal.timeout(5000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Automatic upload unavailable.");
        active = data;
        if (cancelled) { await remove(data); return; }
        setPairing(data);
        setConnection("Waiting for Codex · local upload · link expires in 15 minutes");
        void poll(data);
      } catch {
        if (!cancelled) setConnection("Automatic upload unavailable. Save and import the snapshot file instead.");
      }
    }
    void start();
    return () => { cancelled = true; clearTimeout(timer); if (active) void remove(active); };
  }, [attempt]);

  const prompt = importPrompt(project, pairing ? {
    url: `${window.location.origin}/api/office-import/${pairing.id}`, token: pairing.uploadToken,
  } : undefined);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setError("");
    } catch {
      if (promptDetails.current) promptDetails.current.open = true;
      promptInput.current?.focus();
      promptInput.current?.select();
      setError("Clipboard unavailable. The prompt is selected; copy it with your keyboard.");
    }
  }

  return (
    <dialog ref={dialog} className="welcome-overlay" aria-labelledby="welcome-title" onCancel={(event) => { event.preventDefault(); onExplore(); }}>
        <section className="welcome-card" aria-label="Import your Codex sessions">
          <button className="welcome-close" aria-label="Close import" onClick={onExplore}><X size={18} /></button>
          {snapshot ? <>
            <div className="welcome-heading"><span className="welcome-card-icon"><Check size={20} /></span><span className="eyebrow">SNAPSHOT RECEIVED</span></div>
            <h2 id="welcome-title">{snapshot.agents.length ? "Meet your little coworkers." : "No sessions in this snapshot."}</h2>
            <p>{snapshot.agents.length ? "Selected agents join this world. Existing agents stay here; matching session IDs are updated." : "Try another project or export a new snapshot from Codex."}</p>
            <div className="import-selection">
              {snapshot.agents.map((agent) => <label key={agent.id}>
                <input type="checkbox" checked={selected.has(agent.id)} onChange={() => setSelected((previous) => {
                  const next = new Set(previous); if (next.has(agent.id)) next.delete(agent.id); else next.add(agent.id); return next;
                })} />
                <span><b>{agent.name}</b><small>{agent.history?.length ? `${agent.history.length} recorded events` : "No recorded timeline"} · {agent.model ?? "Model not reported"}</small></span>
              </label>)}
            </div>
            <button className="welcome-action welcome-primary" disabled={!selected.size} onClick={() => { try { onImport(snapshot.agents.filter((a) => selected.has(a.id)), snapshot.interactions?.filter((link) => selected.has(link.fromId) && selected.has(link.toId))); } catch (e) { setError(e instanceof Error ? e.message : "Unable to add agents."); } }}><Play size={16} /> Add to this world <span>{selected.size}</span></button>
            <button className="welcome-action" onClick={() => { setSnapshot(null); setError(""); setAttempt((n) => n + 1); }}>Import another snapshot <RefreshCw size={13} /></button>
          </> : <>
            <div className="welcome-heading"><span className="welcome-card-icon">⌘</span><span className="eyebrow">BRING YOUR CODEX</span></div>
            <h2 id="welcome-title">Your agents. One little office.</h2>
            <p>Copy the prompt into Codex to bring your sessions here.</p>
            {existingCount > 0 && <p className="existing-office">{existingCount} imported {existingCount === 1 ? "agent already lives" : "agents already live"} here. New imports join them.</p>}
            <label className="project-label" htmlFor="import-project">Project <small>Optional</small></label>
            <input id="import-project" className="project-input" value={project} onChange={(e) => { setProject(e.target.value); setCopied(false); }} />
            <small className="project-hint">Leave blank and Codex will ask you.</small>
            <details className="prompt-box" ref={promptDetails}><summary>Preview prompt <span>Read-only export</span></summary><textarea ref={promptInput} aria-label="Codex import prompt" readOnly value={prompt} spellCheck={false} /></details>
            <button className="welcome-action welcome-primary" onClick={copyPrompt} disabled={connection === "Preparing your import…"}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied — paste into Codex" : "Copy prompt for Codex"}<ArrowRight size={16} /></button>
            <p className="import-status" role="status"><span className="footer-dot" />{connection}</p>
            {import.meta.env.DEV && !pairing && connection !== "Preparing your import…" && <button className="welcome-action" onClick={() => setAttempt((n) => n + 1)}>Retry upload connection <RefreshCw size={13} /></button>}
            <div className="welcome-divider"><span>or import a saved snapshot</span></div>
            <button className="welcome-action" onClick={() => fileInput.current?.click()}><FileUp size={16} />Import snapshot file<ArrowRight size={16} /></button>
            <small className="welcome-file-hint">JSON · up to 2 MB · saved in this browser</small>
            <p className="welcome-privacy">Only session metadata and activity. No credentials, file contents or full conversation logs.</p>
          </>}
          <input ref={fileInput} type="file" aria-label="Snapshot file" accept=".json,application/json" hidden onChange={async (event) => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (!file) return;
            try {
              if (file.size > 2_000_000) throw new Error("Choose a snapshot smaller than 2 MB.");
              receive(parseOfficeSnapshot(await file.text()));
            } catch (e) { setError(e instanceof Error ? e.message : "Unable to read snapshot."); }
          }} />
          {error && <p className="welcome-error" role="alert">{error}</p>}
          <button className="welcome-action welcome-skip" onClick={onExplore}>Explore the office <ArrowRight size={16} /></button>
        </section>
    </dialog>
  );
}
