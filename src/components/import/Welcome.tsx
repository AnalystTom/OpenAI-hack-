import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, FileUp, Globe2, Play, RefreshCw, X } from "lucide-react";
import type { AgentInteraction, OfficeAgent, OfficeSnapshot } from "../../types";
import { parseOfficeSnapshot } from "../../snapshot";
import { liveImportPrompt } from "../../integrations/codex/importPrompt";
import { liveApiBase, type LiveRoomConnection } from "../../integrations/codex/useLiveRoom";
import "./welcome.css";

export default function Welcome({ onImport, onExplore, onSocialImport, existingCount = 0, live }: {
  onImport: (agents: OfficeAgent[], interactions?: AgentInteraction[]) => void;
  onExplore: () => void;
  onSocialImport: () => void;
  existingCount?: number;
  live: LiveRoomConnection;
}) {
  const [project, setProject] = useState("");
  const [ownerName, setOwnerName] = useState(() => live.credential?.ownerName ?? localStorage.getItem('dots-uploader-name') ?? '');
  const [preparing, setPreparing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const promptDetails = useRef<HTMLDetailsElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const receive = (data: OfficeSnapshot) => {
    setSnapshot(data);
    setSelected(new Set(data.agents.map((a) => a.id)));
    setError("");
  };

  const prompt = live.credential ? liveImportPrompt(project, {
    url: `${liveApiBase}/api/live/rooms/${live.credential.roomId}/feed`, token: live.credential.uploadToken,
    bridgeUrl: `${window.location.origin}/codex-bridge.mjs`,
  }) : "";

  function explore() {
    const name = ownerName.trim();
    if (name) localStorage.setItem('dots-uploader-name', name);
    onExplore();
  }

  async function prepareLive() {
    setPreparing(true); setError('');
    try {
      if (live.roomId) await live.join(ownerName); else await live.create(ownerName);
      localStorage.setItem('dots-uploader-name', ownerName.trim());
      setCopied(false);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to prepare the room.'); }
    finally { setPreparing(false); }
  }

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

  const nameField = <>
    <label className="project-label" htmlFor="uploader-name">Your name</label>
    <input id="uploader-name" className="project-input" autoComplete="name" maxLength={60} value={ownerName} onChange={e => { setOwnerName(e.target.value); setCopied(false); }} />
    <small className="project-hint">Shown above your bots. This name is provided by you.</small>
  </>;
  return (
    <dialog ref={dialog} className="welcome-overlay" aria-labelledby="welcome-title" onCancel={(event) => { event.preventDefault(); explore(); }}>
        <section className="welcome-card" aria-label="Import your Codex sessions">
          <button className="welcome-close" aria-label="Close import" onClick={explore}><X size={18} /></button>
          {snapshot ? <>
            <div className="welcome-heading"><span className="welcome-card-icon"><Check size={20} /></span><span className="eyebrow">SNAPSHOT RECEIVED</span></div>
            <h2 id="welcome-title">{snapshot.agents.length ? "Meet your little coworkers." : "No sessions in this snapshot."}</h2>
            {nameField}
            <p>{snapshot.agents.length ? live.roomId ? "Selected sessions will be visible to everyone in this room. A snapshot does not stream new activity." : "Selected agents join this world. This file is a recorded snapshot; connect live to stream changes." : "Try another project or export a new snapshot from Codex."}</p>
            <div className="import-selection">
              {snapshot.agents.map((agent) => <label key={agent.id}>
                <input type="checkbox" checked={selected.has(agent.id)} onChange={() => setSelected((previous) => {
                  const next = new Set(previous); if (next.has(agent.id)) next.delete(agent.id); else next.add(agent.id); return next;
                })} />
                <span><b>{agent.name}</b><small>{agent.history?.length ? `${agent.history.length} recorded events` : "No recorded timeline"} · {agent.model ?? "Model not reported"}</small></span>
              </label>)}
            </div>
            <button className="welcome-action welcome-primary" disabled={!selected.size || adding} onClick={async () => { setAdding(true); try {
              const agents = snapshot.agents.filter(a => selected.has(a.id));
              const interactions = snapshot.interactions?.filter(link => selected.has(link.fromId) && selected.has(link.toId));
              if (live.roomId) { await live.publishSnapshot({ version: 1, agents, interactions }, ownerName); onExplore(); }
              else {
                if (!ownerName.trim() || ownerName.trim().length > 60) throw new Error('Enter your name before adding agents.');
                localStorage.setItem('dots-uploader-name', ownerName.trim());
                onImport(agents.map(a => ({ ...a, ownerName: ownerName.trim(), status: a.status === 'working' ? 'unknown' : a.status })), interactions);
              }
            } catch (e) { setError(e instanceof Error ? e.message : "Unable to add agents."); } finally { setAdding(false); } }}><Play size={16} />{adding ? 'Adding sessions…' : 'Add to this world'}<span>{selected.size}</span></button>
            <button className="welcome-action" onClick={() => { setSnapshot(null); setError(""); }}>Import another snapshot <RefreshCw size={13} /></button>
          </> : <>
            <div className="welcome-heading"><span className="welcome-card-icon">⌘</span><span className="eyebrow">BRING YOUR CODEX</span></div>
            <h2 id="welcome-title">Your agents. One little office.</h2>
            <p>Stream your selected Codex agents here and invite other people to work alongside them.</p>
            {nameField}
            {existingCount > 0 && <p className="existing-office">{existingCount} imported {existingCount === 1 ? "agent already lives" : "agents already live"} here. New imports join them.</p>}
            <label className="project-label" htmlFor="import-project">Project <small>Optional</small></label>
            <input id="import-project" className="project-input" value={project} onChange={(e) => { setProject(e.target.value); setCopied(false); }} />
            <small className="project-hint">Leave blank and Codex will ask you.</small>
            {(!live.credential?.ownerName || live.credential.ownerName !== ownerName.trim()) && <button className="welcome-action welcome-primary" onClick={prepareLive} disabled={preparing || !ownerName.trim()}>{preparing ? 'Preparing live room…' : live.credential ? 'Save uploader name' : live.roomId ? 'Join this live room' : 'Create live room'}<ArrowRight size={16} /></button>}
            {live.credential?.ownerName === ownerName.trim() && <details className="prompt-box" ref={promptDetails}><summary>Preview prompt <span>Selected live sessions</span></summary><textarea ref={promptInput} aria-label="Codex import prompt" readOnly value={prompt} spellCheck={false} /></details>}
            {live.credential?.ownerName === ownerName.trim() && <button className="welcome-action welcome-primary" onClick={copyPrompt} disabled={preparing}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied — paste into Codex" : "Copy live prompt for Codex"}<ArrowRight size={16} /></button>}
            <p className="import-status" role="status"><span className="footer-dot" />{live.credential ? 'Choose sessions in Codex, then keep the bridge terminal open. Activity updates automatically.' : 'Create a live room to stream activity, or import a saved file.'}</p>
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
          <button className="welcome-action" onClick={onSocialImport}><Globe2 size={16} /> Personalize with LinkedIn or X <ArrowRight size={16} /></button>
          <button className="welcome-action welcome-skip" onClick={explore}>{live.roomId ? 'Go to live room' : 'Explore the office'}<ArrowRight size={16} /></button>
        </section>
    </dialog>
  );
}
