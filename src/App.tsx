import { AgentVitals } from "./components/AgentVitals";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Coffee,
  Heart,
  Maximize,
  Moon,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import OfficeWorld, { CHARACTERS } from "./components/OfficeWorld";
import type { OfficeAgent } from "./types";
import { parseOfficeSnapshot } from "./snapshot";
import {
  createOfficeReplay,
  appendOfficeReplay,
  agentActivityLabel,
  replayOffice,
  officeSummary,
  replayClockLabel,
  type OfficeReplay,
} from "./officeReplay";
import { agentCharacter, STATUS_LABELS } from "./officeBehavior";
import { useRobotsSessions } from "./integrations/codex/useRobotsSessions";
import Welcome from "./components/import/Welcome";
import { mergeOfficeAgents, readSavedOffice, serializeOffice, OFFICE_STORAGE_KEY, ENTERED_STORAGE_KEY } from "./officeStore";

export default function App() {
  const [saved] = useState(() => {
    try { return readSavedOffice(localStorage); }
    catch { return { agents: [], error: "Browser storage is unavailable. Your office cannot be saved on this device." }; }
  });
  const [welcome, setWelcome] = useState(() => {
    try { return localStorage.getItem(ENTERED_STORAGE_KEY) !== "yes"; } catch { return true; }
  });
  const [agents, setAgents] = useState<OfficeAgent[]>(saved.agents);
  const agentsRef = useRef(agents);
  const [officeError, setOfficeError] = useState(saved.error);
  const [preview, setPreview] = useState(
    () => !saved.agents.length && sessionStorage.getItem("dots-robots-connected") !== "yes",
  );
  const [paused, setPaused] = useState(false);
  const [night, setNight] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const office = useRef<HTMLDivElement>(null);
  const character = CHARACTERS.find((c) => c.kind === selected);
  function addAgents(incoming: OfficeAgent[]) {
    const merged = mergeOfficeAgents(agentsRef.current, incoming);
    try { localStorage.setItem(OFFICE_STORAGE_KEY, serializeOffice(merged)); }
    catch { throw new Error("This browser could not save the office. Free some browser storage and try importing again."); }
    agentsRef.current = merged;
    setAgents(merged);
    setOfficeError("");
    return merged;
  }
  function dismissWelcome() {
    setWelcome(false);
    try { localStorage.setItem(ENTERED_STORAGE_KEY, "yes"); }
    catch { setOfficeError("Browser storage is unavailable. The welcome card will reappear on refresh."); }
  }
  const local = useRobotsSessions((incoming) => {
    if (!incoming.length) return;
    try { addAgents(incoming); } catch (e) { setOfficeError(e instanceof Error ? e.message : "Unable to save office."); }
  });
  const [replay, setReplay] = useState<OfficeReplay | null>(null);
  const [replayElapsed, setReplayElapsed] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(10);
  const autoStartReplay = useRef(true);
  function startOfficeReplay(source = agents) {
    setReplay(createOfficeReplay(source));
    setReplayElapsed(0);
    setPaused(false);
  }
  useEffect(() => {
    if (!agents.length || !autoStartReplay.current) return;
    autoStartReplay.current = false;
    startOfficeReplay(agents);
  }, [agents]);
  useEffect(() => {
    if (!replay || paused || replayElapsed >= replay.durationMs) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = now - last;
      last = now;
      setReplayElapsed((elapsed) =>
        Math.min(replay.durationMs, elapsed + delta * replaySpeed),
      );
    }, 100);
    return () => clearInterval(timer);
  }, [replay, paused, replaySpeed, replayElapsed >= (replay?.durationMs ?? 0)]);
  const visibleAgents = replay
    ? replayOffice(replay, replayElapsed)
    : agents.map((a) =>
        local.enabled && local.state === "error"
          ? { ...a, status: "offline" as const }
          : a,
      );
  const summary = officeSummary(visibleAgents, !!replay);
  const agent = visibleAgents.find((a) => a.id === selected);
  const behavior = (a: OfficeAgent) => agentActivityLabel(a) ?? STATUS_LABELS[a.status];
  function connectRobots() {
    autoStartReplay.current = true;
    setReplay(null);
    setSelected(null);
    setPreview(false);
    setModal(false);
    local.connect();
  }
  function watchLocal(source: string) {
    autoStartReplay.current = false;
    setReplay(null);
    setSelected(null);
    setPreview(false);
    setWelcome(false);
    setPaused(false);
    local.connect(source);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a snapshot smaller than 2 MB.");
      const snapshot = parseOfficeSnapshot(await file.text());
      local.disconnect();
      autoStartReplay.current = false;
      const merged = addAgents(snapshot.agents);
      if (replay) setReplay(appendOfficeReplay(replay, snapshot.agents, replayElapsed));
      else startOfficeReplay(merged);
      setPreview(false);
      setSelected(null);
      setModal(false);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to read this snapshot.",
      );
    }
    event.target.value = "";
  }
  function switchView(value: boolean) {
    setPreview(value);
    setSelected(null);
  }
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Dots home">
          <span className="dotmark">
            <i />
            <i />
            <i />
            <i />
          </span>
          dots<span className="wordmark-dot">.</span>
        </a>
        <div className="header-divider" />
        <span className="office-name">
          The little office <span>HQ</span>
        </span>
        <nav aria-label="Office views">
          <button
            className={preview ? "active" : ""}
            onClick={() => switchView(true)}
          >
            <Box size={15} />
            Characters
          </button>
          <button
            className={!preview ? "active" : ""}
            onClick={() => switchView(false)}
          >
            <Users size={15} />
            Your agents {agents.length > 0 && <small>{agents.length}</small>}
          </button>
        </nav>
        <button className="import-button" onClick={() => setWelcome(true)}>
          <ArrowDownToLine size={15} />
          Import agents
        </button>
      </header>
      <main>
        <aside className="sidebar">
          <div className="eyebrow">
            <span /> A NEW WAY TO WORK
          </div>
          <h1>
            Big ideas.
            <br />
            Little coworkers<span>.</span>
          </h1>
          <p className="intro">
            Your AI team deserves more than another browser tab.
          </p>
          <div className="section-heading">
            {preview ? "MEET THE LITTLE GUYS" : "YOUR OFFICE"}
            <span>{preview ? CHARACTERS.length : agents.length}</span>
          </div>
          {preview ? (
            <div className="roster">
              {CHARACTERS.map((c) => (
                <button
                  key={c.kind}
                  className={`roster-item ${selected === c.kind ? "selected" : ""}`}
                  onClick={() => setSelected(c.kind)}
                >
                  <span
                    className={`avatar ${c.kind}`}
                    style={{ "--avatar": c.color } as React.CSSProperties}
                  >
                    {c.kind === "lovable" ? (
                      <Heart size={21} fill="currentColor" />
                    ) : (
                      <span className="eyes">••</span>
                    )}
                  </span>
                  <span>
                    <b>{c.name}</b>
                    <small>
                      {c.kind === "lovable"
                        ? "Lovable heart"
                        : "Dots character"}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : agents.length ? (
            <div className="roster">
              {visibleAgents.map((a) => (
                <button
                  className={`roster-item ${selected === a.id ? "selected" : ""}`}
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                >
                  <span
                    className="avatar"
                    style={
                      {
                        "--avatar": CHARACTERS.find(
                          (c) =>
                            c.kind ===
                            (a.character ??
                              agentCharacter(a.id, a.model, a.harness)),
                        )!.color,
                      } as React.CSSProperties
                    }
                  >
                    <span className="eyes">••</span>
                  </span>
                  <span>
                    <b title={a.name}>{a.name}</b>
                    <small>{behavior(a)}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-team">
              <Users size={25} />
              <h3>Room for your team</h3>
              <p>
                Import a real agent snapshot to bring your own coworkers into
                the office.
              </p>
              <button onClick={() => setModal(true)}>
                Bring your agents <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          <div className="sidebar-bottom">
            {import.meta.env.DEV && <div className="local-source-controls">
              <label htmlFor="local-source">Watch local Codex sessions</label>
              <select id="local-source" value={local.enabled ? local.source : ""} onChange={(e) => watchLocal(e.target.value)}>
                <option value="" disabled>Choose a source</option>
                <option value="robots">Robots sessions</option>
                <option value="demo">Six Luna demo sessions</option>
                <option value="design">Design Codex session replay</option>
              </select>
              {local.enabled && <button onClick={() => { setReplay(null); setPaused(false); }}>Watch live status</button>}
            </div>}
            {local.enabled && (
              <div className="connection-summary">
                <b>
                  {local.source === "robots" ? "Robots" : local.source === "demo" ? "Luna demo" : "Design session"} ·{" "}
                  {local.state === "connected" ? "local feed" : local.state}
                </b>
                <span>
                  {agents.length} recent sessions
                  {local.total ? ` of ${local.total}` : ""}
                </span>
                <button
                  onClick={() => {
                    local.disconnect();
                    setReplay(null);
                    // Disconnecting the feed keeps the saved residents.
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}

            <div className="coffee-note">
              <Coffee size={18} />
              <p>
                {preview
                  ? "No meetings. Just little guys."
                  : "A window into your team."}
                <small>
                  {preview
                    ? "Character preview · no live agent activity"
                    : local.enabled
                      ? "Visualising session events · refreshed every 5s"
                      : "Imported snapshots are not live connections."}
                </small>
              </p>
            </div>
          </div>
        </aside>
        <section
          className={`world ${night ? "night" : ""}`}
          ref={office}
          aria-label="Office playground"
        >
          <div className="world-top">
            <div className="world-caption">
              <span className="live-dot" />
              {preview
                ? "CHARACTER PLAYGROUND"
                : replay
                  ? "RECORDED TASK REPLAY"
                  : "YOUR AGENT OFFICE"}
              <span className="mode-label">
                {preview
                  ? "Preview"
                  : replay
                    ? "Replay"
                    : local.enabled
                      ? local.state === "connected"
                        ? "Local feed"
                        : local.state
                      : "Snapshot"}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="How to explore"
              onClick={() => setHelp(!help)}
            >
              <CircleHelp size={18} />
            </button>
          </div>
          <OfficeWorld
            agents={visibleAgents}
            preview={preview}
            paused={paused}
            night={night}
            cameraKey={cameraKey}
            selected={selected}
            onSelect={setSelected}
            onReady={() => setReady(true)}
          />
          {!preview &&
            local.enabled &&
            local.state === "loading" &&
            !agents.length && (
              <div className="connection-banner" role="status">
                Reading your Codex sessions…
              </div>
            )}
          {!preview && !replay && local.error && (
            <div className="connection-banner error" role="alert">
              {local.error}
            </div>
          )}
          {!preview && replay && (
            <div className="replay-banner" role="status">
              <b>Parallel session replay</b>
              <span className="replay-clock">
                T+{replayClockLabel(replayElapsed)} · aligned task starts
              </span>
              <label className="replay-speed">
                Speed{" "}
                <select
                  aria-label="Replay speed"
                  value={replaySpeed}
                  onChange={(e) => setReplaySpeed(Number(e.target.value))}
                >
                  <option value={1}>1×</option>
                  <option value={10}>10×</option>
                  <option value={60}>60×</option>
                </select>
              </label>
              <button onClick={() => startOfficeReplay(replay.agents)}>
                Restart all sessions
              </button>
              <button onClick={() => setReplay(null)}>
                Return to current state
              </button>
            </div>
          )}
          {!preview && visibleAgents.length > 0 && (
            <section className="office-summary" aria-label="Office summary">
              <span>{replay ? "REPLAY" : "IN THE OFFICE"}</span>
              <p>{summary}</p>
            </section>
          )}
          {!preview && !replay && visibleAgents.some((a) => (a.history?.length ?? 0) > 1) && (
            <button className="replay-entry" onClick={() => startOfficeReplay()}>Replay all sessions together</button>
          )}
          {!ready && <div className="loading-state">Opening the office…</div>}
          {!preview && !agents.length && (
            <div className="world-empty">
              <span className="empty-icon">
                <Users size={22} />
              </span>
              <h2>Your team belongs here.</h2>
              <p>Connect the dots. Start with your agents.</p>
              <button className="import-button" onClick={() => setModal(true)}>
                Import agents <ArrowUpRight size={15} />
              </button>
            </div>
          )}
          {help && (
            <div className="help-card">
              <b>Make yourself at home.</b>
              <p>
                Drag to orbit · scroll to zoom · right-drag to pan. Click a
                character to say hello. Pick up the toy hammer and click a coworker
                to send their character to a desk. Escape or right-click puts it down.
              </p>
              <small>
                Movement in the playground is animation, not agent activity.
              </small>
            </div>
          )}
          {(character || agent) && (
            <div className="detail-card">
              <button
                className="close"
                aria-label="Close details"
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </button>
              <span className="eyebrow">
                {character ? "CHARACTER STUDIO" : agent?.harness}
              </span>
              <h2>{character?.name ?? agent?.name}</h2>
              {agent && (
                <span className={`agent-behavior ${agent.status}`}>
                  {behavior(agent)}
                  {replay ? " · recorded replay" : ""}
                </span>
              )}
              {agent && (
                <small>
                  {agent.status === "working"
                    ? "Session task"
                    : "Last session task"}
                </small>
              )}
              <p>
                {character?.description ??
                  agent?.task ??
                  "No current task reported."}
              </p>
              {character ? (
                <span className="detail-tag">
                  <Sparkles size={12} /> Original 3D character · animated
                </span>
              ) : (
                agent && (
                  <>
                    <dl>
                      <div>
                        <dt>Status</dt>
                        <dd>{agent.status}</dd>
                      </div>
                      <div>
                        <dt>Model</dt>
                        <dd>{agent.model ?? "Not reported"}</dd>
                      </div>
                    </dl>
                    <AgentVitals agent={agent} />
                    <small>
                      Source event {new Date(agent.updatedAt).toLocaleString()}
                    </small>
                    {agent.playback && <small className="context-note">{agent.playback.label}</small>}
                    {agent.history && agent.history.length > 1 && (
                      <button
                        className="replay-button"
                        onClick={() => startOfficeReplay()}
                      >
                        <Play size={13} />
                        Replay all sessions together
                      </button>
                    )}
                    {local.enabled && (
                      <small className="context-note">
                        Context is the last reported input size, not lifetime
                        usage.
                      </small>
                    )}
                  </>
                )
              )}
            </div>
          )}
          <div className="world-bottom">
            <span className="interaction-hint">
              <MousePointer2 size={13} />
              Drag to explore. Click a little guy.
            </span>
            <div className="world-controls">
              <button
                aria-label={replay && replayElapsed >= replay.durationMs ? (paused ? "Resume animation" : "Pause animation") : (paused ? "Resume office" : "Pause office")}
                title={replay && replayElapsed >= replay.durationMs ? "Replay finished · control idle animation" : (paused ? "Resume office" : "Pause office")}
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play size={17} /> : <Pause size={17} />}
              </button>
              <span />
              <button
                aria-label="Reset camera"
                title="Reset camera"
                onClick={() => setCameraKey((k) => k + 1)}
              >
                <RotateCcw size={17} />
              </button>
              <button
                aria-label={night ? "Switch to daytime" : "Switch to nighttime"}
                title="Change lighting"
                onClick={() => setNight(!night)}
              >
                {night ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                aria-label="Toggle fullscreen"
                title="Fullscreen"
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  else
                    office.current
                      ?.requestFullscreen()
                      .catch(() =>
                        setError("Fullscreen is unavailable in this browser."),
                      );
                }}
              >
                <Maximize size={17} />
              </button>
            </div>
            <span className="corner-note">
              Made of pixels. Full of personality.
            </span>
          </div>
        </section>
      </main>
      <footer>
        <span>
          <span className="footer-dot" />
          {preview
            ? "A playground for your future team"
            : replay
              ? "Recorded task replay · no task is being executed"
              : local.enabled
                ? `${agents.length} Codex sessions · ${local.state} · checked ${local.observedAt ? new Date(local.observedAt).toLocaleTimeString() : "—"}`
                : `${agents.length} imported agents · snapshot mode`}
        </span>
        <span>
          Powered by Three.js <span className="footer-separator">/</span> Built
          with a little <Heart size={11} />
        </span>
      </footer>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close import"
              onClick={() => setModal(false)}
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <ArrowDownToLine size={24} />
            </span>
            <div className="eyebrow">BRING YOUR OWN LITTLE GUYS</div>
            <h2 id="import-title">Make room for your agents.</h2>
            <p>
              Import a real office snapshot to see your team here. Your agents
              join this world and are saved in this browser.
            </p>
            <div className="connection-row">
              <span className="codex-symbol">⌘</span>
              <div>
                <b>Codex</b>
                <small>Read sessions from your configured local project</small>
              </div>
              <span className="connection-status">
                {local.state === "connected" ? "Connected" : "Local only"}
              </span>
            </div>
            <button className="file-import" onClick={connectRobots}>
              <Users size={19} />
              <span>
                <b>Import local sessions</b>
                <small>
                  6 recent sessions · read-only · refreshes every 5s
                </small>
              </span>
              <ChevronRight size={17} />
            </button>
            <p className="privacy-note">
              Local import reads session metadata on this computer. It does not
              run or restart your agents.
            </p>
            <button
              className="file-import"
              onClick={() => input.current?.click()}
            >
              <ArrowDownToLine size={19} />
              <span>
                <b>Import agent snapshot</b>
                <small>Office snapshot JSON · up to 2 MB</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              onChange={importFile}
              hidden
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <p className="privacy-note">
              <Check size={13} />
              No invented activity, token counts, or progress.
            </p>
          </section>
        </div>
      )}
      {welcome && <Welcome existingCount={agents.length} onExplore={dismissWelcome} onImport={(imported) => {
        const merged = addAgents(imported);
        local.disconnect();
        autoStartReplay.current = false;
        setPreview(false);
        if (replay) setReplay(appendOfficeReplay(replay, imported, replayElapsed));
        else startOfficeReplay(merged);
        dismissWelcome();
      }} />}

    </div>
  );
}
