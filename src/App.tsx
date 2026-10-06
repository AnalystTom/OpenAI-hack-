import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Coffee,
  Github,
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

export default function App() {
  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const [preview, setPreview] = useState(true);
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
  const character = preview
    ? CHARACTERS.find((c) => c.kind === selected)
    : undefined;
  const agent = !preview ? agents.find((a) => a.id === selected) : undefined;
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a snapshot smaller than 2 MB.");
      const snapshot = parseOfficeSnapshot(await file.text());
      setAgents(snapshot.agents);
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
            The playground
          </button>
          <button
            className={!preview ? "active" : ""}
            onClick={() => switchView(false)}
          >
            <Users size={15} />
            Your agents {agents.length > 0 && <small>{agents.length}</small>}
          </button>
        </nav>
        <button className="import-button" onClick={() => setModal(true)}>
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
              {agents.map((a, i) => (
                <button
                  className={`roster-item ${selected === a.id ? "selected" : ""}`}
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                >
                  <span
                    className="avatar"
                    style={
                      {
                        "--avatar": CHARACTERS[i % 6].color,
                      } as React.CSSProperties
                    }
                  >
                    <span className="eyes">••</span>
                  </span>
                  <span>
                    <b>{a.name}</b>
                    <small>
                      {a.harness} · {a.status}
                    </small>
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
            <div className="coffee-note">
              <Coffee size={18} />
              <p>
                {preview
                  ? "No meetings. Just little guys."
                  : "A window into your team."}
                <small>
                  {preview
                    ? "Character preview · no live agent activity"
                    : "Imported snapshots are not live connections."}
                </small>
              </p>
            </div>
            <a
              href="https://github.com/iamlukethedev/Claw3D"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={13} />
              Built on Claw3D
              <ArrowUpRight size={12} />
            </a>
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
              {preview ? "CHARACTER PLAYGROUND" : "YOUR AGENT OFFICE"}
              <span className="mode-label">
                {preview ? "Preview" : "Snapshot"}
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
            agents={agents}
            preview={preview}
            paused={paused}
            night={night}
            cameraKey={cameraKey}
            selected={selected}
            onSelect={setSelected}
            onReady={() => setReady(true)}
          />
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
                character to say hello.
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
                      <div>
                        <dt>Context</dt>
                        <dd>
                          {agent.contextUsed !== null &&
                          agent.contextWindow !== null
                            ? `${Math.round((agent.contextUsed / agent.contextWindow) * 100)}%`
                            : "Not reported"}
                        </dd>
                      </div>
                    </dl>
                    <small>
                      Snapshot updated{" "}
                      {new Date(agent.updatedAt).toLocaleString()}
                    </small>
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
                aria-label={paused ? "Resume walking" : "Pause walking"}
                title={paused ? "Resume walking" : "Pause walking"}
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
              Import a real office snapshot to see your team here. Your file
              stays in this browser tab.
            </p>
            <div className="connection-row">
              <span className="codex-symbol">⌘</span>
              <div>
                <b>Codex</b>
                <small>Account connection not available yet</small>
              </div>
              <span className="connection-status">Not connected</span>
            </div>
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
    </div>
  );
}
