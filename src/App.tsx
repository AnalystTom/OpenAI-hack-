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
  BookOpen,
  Palette,
  Share2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import OfficeWorld, { CHARACTERS } from "./components/OfficeWorld";
import type { AgentInteraction, OfficeAgent, RecordedActivity } from "./types";
import { parseOfficeSnapshot } from "./snapshot";
import { agentCharacter, liveInteractions } from "./officeBehavior";
import { useRobotsSessions } from "./integrations/codex/useRobotsSessions";
import RoomStudio from "./components/RoomStudio";
import {
  DEFAULT_SHARE, EMPTY_PROFILE, EMPTY_STATS, readGuestRoom,
  type GuestRoom, type KnowledgeBook, type RoomProfile, type RoomProject,
  type RoomStats, type ShareOptions,
} from "./socialRoom";

function readRoomDraft() {
  try {
    const raw = localStorage.getItem("dots-room-draft-v1");
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const validTheme = ["studio", "grove", "coastal", "cosmic"].includes(value.profile?.theme);
    return {
      profile: validTheme && typeof value.profile?.displayName === "string" && typeof value.profile?.socialUrl === "string" && typeof value.profile?.interests === "string" ? value.profile as RoomProfile : EMPTY_PROFILE,
      books: Array.isArray(value.books) ? value.books.filter((book: KnowledgeBook) => book && typeof book.id === "string" && typeof book.title === "string" && typeof book.summary === "string").slice(0, 8) as KnowledgeBook[] : [],
      projects: Array.isArray(value.projects) ? value.projects.filter((project: RoomProject) => project && typeof project.id === "string" && typeof project.title === "string" && typeof project.url === "string").slice(0, 8) as RoomProject[] : [],
      stats: value.stats && typeof value.stats === "object" ? { ...EMPTY_STATS, ...value.stats, agentTotals: value.stats.agentTotals && typeof value.stats.agentTotals === "object" ? value.stats.agentTotals : {} } as RoomStats : EMPTY_STATS,
      share: value.share && typeof value.share === "object" ? { ...DEFAULT_SHARE, ...value.share } as ShareOptions : DEFAULT_SHARE,
    };
  } catch { return null; }
}
const roomDraft = readRoomDraft();

export default function App() {
  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const [interactions, setInteractions] = useState<AgentInteraction[]>([]);
  const [interactionClock, setInteractionClock] = useState(Date.now());
  const [preview, setPreview] = useState(
    () => sessionStorage.getItem("dots-robots-connected") !== "yes",
  );
  const [paused, setPaused] = useState(false);
  const [night, setNight] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [studioTab, setStudioTab] = useState<"profile" | "library" | "projects" | "invite" | null>(null);
  const [profile, setProfile] = useState<RoomProfile>(roomDraft?.profile ?? EMPTY_PROFILE);
  const [books, setBooks] = useState<KnowledgeBook[]>(roomDraft?.books ?? []);
  const [projects, setProjects] = useState<RoomProject[]>(roomDraft?.projects ?? []);
  const [stats, setStats] = useState<RoomStats>(roomDraft?.stats ?? EMPTY_STATS);
  const [share, setShare] = useState<ShareOptions>(roomDraft?.share ?? DEFAULT_SHARE);
  const [guest, setGuest] = useState<GuestRoom | null>(() => readGuestRoom(window.location.hash));
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [openedBooks, setOpenedBooks] = useState<string[]>([]);
  useEffect(() => {
    try { localStorage.setItem("dots-room-draft-v1", JSON.stringify({ profile, books, projects, stats, share })); }
    catch { /* The current room remains usable when browser storage is unavailable. */ }
  }, [profile, books, projects, stats, share]);
  useEffect(() => {
    const update = () => { setGuest(readGuestRoom(window.location.hash)); setSelected(null); setSelectedBook(null); setSelectedProject(null); setOpenedBooks([]); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const input = useRef<HTMLInputElement>(null);
  const office = useRef<HTMLDivElement>(null);
  const showPreview = !guest && preview;
  const visibleProfile = guest?.profile ?? profile;
  const visibleBooks = guest?.books ?? books;
  const visibleProjects = guest?.projects ?? projects;
  const character = showPreview
    ? CHARACTERS.find((c) => c.kind === selected)
    : undefined;
  const local = useRobotsSessions((snapshot) => {
    setAgents(snapshot.agents);
    setInteractions(snapshot.interactions ?? []);
    setInteractionClock(Date.now());
  });
  useEffect(() => {
    if (!interactions.length) return;
    const timer = setInterval(() => setInteractionClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [interactions.length]);
  const [replay, setReplay] = useState<{
    id: string;
    history: RecordedActivity[];
    started: number;
  } | null>(null);
  const [replayAt, setReplayAt] = useState(0);
  useEffect(() => {
    if (!replay) return;
    const start = Date.parse(replay.history[0].at),
      end = Date.parse(replay.history[replay.history.length - 1].at);
    const tick = () =>
      setReplayAt(
        start +
          Math.min(1, (Date.now() - replay.started) / 20000) * (end - start),
      );
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [replay]);
  const recordedEvent = replay?.history
    .filter((event) => Date.parse(event.at) <= replayAt)
    .at(-1);
  const visibleAgents = agents.map((a) => {
    if (replay?.id === a.id)
      return {
        ...a,
        status: recordedEvent?.status ?? ("working" as const),
        contextUsed: null,
        contextWindow: null,
      };
    return local.enabled && local.state === "error"
      ? { ...a, status: "offline" as const }
      : a;
  });
  const roomAgents = guest?.agents ?? visibleAgents;
  const activeLinks = guest || showPreview || replay || (local.enabled && local.state !== "connected")
    ? [] : liveInteractions(roomAgents, interactions, interactionClock);
  const linkedPartner = (id: string) => {
    const link = activeLinks.find((item) => item.fromId === id || item.toId === id);
    return link && roomAgents.find((item) => item.id === (link.fromId === id ? link.toId : link.fromId));
  };
  const agent = !showPreview
    ? roomAgents.find((a) => a.id === selected)
    : undefined;
  const book = visibleBooks.find((item) => item.id === selectedBook);
  const project = visibleProjects.find((item) => item.id === selectedProject);
  function selectAgent(id: string) { setSelected(id); setSelectedBook(null); setSelectedProject(null); }
  function selectBook(id: string) { setSelected(null); setSelectedProject(null); setSelectedBook(id); setOpenedBooks((current) => current.includes(id) ? current : [...current, id]); }
  function selectProject(id: string) { setSelected(null); setSelectedBook(null); setSelectedProject(id); }
  function leaveGuest() { window.location.hash = ""; setGuest(null); }
  const behavior = (a: OfficeAgent) =>
    linkedPartner(a.id)
      ? `Working with ${linkedPartner(a.id)!.name}`
      : a.status === "working"
      ? "Working at desk"
      : a.status === "idle"
        ? "Waiting for a task"
        : a.status === "offline"
          ? "Source disconnected"
          : a.status === "unknown"
            ? "Status not confirmed"
            : a.status;
  function connectRobots() {
    setReplay(null);
    setSelected(null);
    setInteractions([]);
    setPreview(false);
    setModal(false);
    local.connect();
  }
  function startReplay(a: OfficeAgent) {
    if (!a.history?.length) return;
    setReplayAt(Date.parse(a.history[0].at));
    setPaused(false);
    setReplay({ id: a.id, history: a.history, started: Date.now() });
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a snapshot smaller than 2 MB.");
      const snapshot = parseOfficeSnapshot(await file.text());
      local.disconnect();
      setReplay(null);
      setAgents(snapshot.agents);
      setInteractions(snapshot.interactions ?? []);
      setInteractionClock(Date.now());
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
    setReplay(null);
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
        {guest ? <nav aria-label="Shared room"><span className="guest-nav-label">Visiting {guest.profile.displayName}</span><button onClick={leaveGuest}>Back to my room</button></nav> : <nav aria-label="Office views">
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
        </nav>}
        <div className="topbar-actions">
          {!guest && <button className="studio-button" onClick={() => setStudioTab("profile")}><Palette size={15} /> Room studio</button>}
          {!guest && <button className="import-button" onClick={() => setModal(true)}><ArrowDownToLine size={15} /> Import agents</button>}
        </div>
      </header>
      <main>
        <aside className={`sidebar ${guest ? "guest-sidebar" : ""}`}>
          <div className="eyebrow"><span /> {guest ? "FRIEND'S ROOM" : "A NEW WAY TO WORK"}</div>
          <h1>{guest ? guest.profile.displayName : profile.displayName === "My room" ? <>Big ideas.<br />Little coworkers<span>.</span></> : <>{profile.displayName}<span>.</span></>}</h1>
          <p className="intro">{guest ? "A shared snapshot of this friend's agent world." : profile.interests || "Your AI team deserves more than another browser tab."}</p>
          {visibleProfile.socialUrl && <a className="social-link" href={visibleProfile.socialUrl} target="_blank" rel="noreferrer">View social profile <ArrowUpRight size={12} /></a>}
          <div className="section-heading">
            {showPreview ? "MEET THE LITTLE GUYS" : guest ? "SHARED AGENTS" : "YOUR OFFICE"}
            <span>{showPreview ? CHARACTERS.length : roomAgents.length}</span>
          </div>
          {showPreview ? (
            <div className="roster">
              {CHARACTERS.map((c) => (
                <button
                  key={c.kind}
                  className={`roster-item ${selected === c.kind ? "selected" : ""}`}
                  onClick={() => selectAgent(c.kind)}
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
          ) : roomAgents.length ? (
            <div className="roster">
              {roomAgents.map((a) => (
                <button
                  className={`roster-item ${selected === a.id ? "selected" : ""}`}
                  key={a.id}
                  onClick={() => selectAgent(a.id)}
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
              <h3>{guest ? "No agents shared" : "Room for your team"}</h3>
              <p>{guest ? "This invitation did not include agent sessions." : "Import a real agent snapshot to bring your own coworkers into the office."}</p>
              {!guest && <button onClick={() => setModal(true)}>Bring your agents <ArrowUpRight size={14} /></button>}
            </div>
          )}
          <div className="room-collections">
            <button onClick={() => guest ? visibleBooks[0] && selectBook(visibleBooks[0].id) : setStudioTab("library")}><BookOpen size={15} /><span>Learning library</span><b>{visibleBooks.length}</b></button>
            {visibleBooks.length > 0 && <small>{openedBooks.filter((id) => visibleBooks.some((item) => item.id === id)).length} of {visibleBooks.length} books explored</small>}
            <button onClick={() => guest ? visibleProjects[0] && selectProject(visibleProjects[0].id) : setStudioTab("projects")}><Sparkles size={15} /><span>Project wall</span><b>{visibleProjects.length}</b></button>
          </div>
          {guest?.stats && <div className="friend-stats"><b>Shared totals</b><span>Tokens <strong>{guest.stats.totalTokens === null ? "Not shared" : guest.stats.totalTokens.toLocaleString()}</strong></span><span>Spend <strong>{guest.stats.totalSpend === null ? "Not shared" : `${guest.stats.currency} ${guest.stats.totalSpend.toFixed(2)}`}</strong></span><small>Owner-entered snapshot</small></div>}
          <div className="sidebar-bottom">
            {!guest && local.enabled && (
              <div className="connection-summary">
                <b>
                  {local.project || "Codex"} ·{" "}
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
                    setAgents([]);
                    setInteractions([]);
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}

            <div className="coffee-note">
              <Coffee size={18} />
              <p>
                {showPreview
                  ? "No meetings. Just little guys."
                  : guest ? "A friend's shared world." : "A window into your team."}
                <small>
                  {showPreview
                    ? "Character preview · no live agent activity"
                    : guest ? "Read-only invitation snapshot" : local.enabled
                      ? "Recorded status and links · refreshed every 5s"
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
              {showPreview
                ? "CHARACTER PLAYGROUND"
                : guest ? "FRIEND'S ROOM" : replay
                  ? "RECORDED TASK REPLAY"
                  : "YOUR AGENT OFFICE"}
              <span className="mode-label">
                {showPreview
                  ? "Preview"
                  : guest ? "Shared snapshot" : replay
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
            agents={roomAgents}
            interactions={activeLinks}
            preview={showPreview}
            paused={paused}
            night={night}
            cameraKey={cameraKey}
            selected={selected}
            onSelect={selectAgent}
            profile={visibleProfile}
            books={visibleBooks}
            projects={visibleProjects}
            selectedBook={selectedBook}
            selectedProject={selectedProject}
            onSelectBook={selectBook}
            onSelectProject={selectProject}
            onInvite={guest ? undefined : () => setStudioTab("invite")}
            onReady={() => setReady(true)}
          />
          {!guest && !showPreview &&
            local.enabled &&
            local.state === "loading" &&
            !agents.length && (
              <div className="connection-banner" role="status">
                Reading your Robots sessions…
              </div>
            )}
          {!guest && !showPreview && local.error && (
            <div className="connection-banner error" role="alert">
              {local.error}
            </div>
          )}
          {!guest && !showPreview && replay && (
            <div className="replay-banner" role="status">
              <b>Recorded replay</b>
              <span>
                {recordedEvent?.label ?? "Task started"} ·{" "}
                {new Date(replayAt).toLocaleTimeString()}
              </span>
              <button onClick={() => setReplay(null)}>
                Return to current state
              </button>
            </div>
          )}
          {activeLinks.length > 0 && <div className="collaboration-banner" role="status">
            <b>Recent session link</b>
            {activeLinks.map((link) => {
              const from = roomAgents.find((item) => item.id === link.fromId);
              const to = roomAgents.find((item) => item.id === link.toId);
              return <button key={`${link.fromId}-${link.toId}`} onClick={() => selectAgent(link.fromId)}>
                {from?.name} + {to?.name} · {link.kind === "delegation" ? "delegation" : "message call"}
              </button>;
            })}
          </div>}
          {!ready && <div className="loading-state">Opening the office…</div>}
          {!guest && !showPreview && !agents.length && (
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
                Live positions follow recorded session state. Play appears only after a recent recorded link between two working sessions.
              </small>
            </div>
          )}
          {(character || agent || book || project) && (
            <div className="detail-card">
              <button
                className="close"
                aria-label="Close details"
                onClick={() => { setSelected(null); setSelectedBook(null); setSelectedProject(null); }}
              >
                <X size={16} />
              </button>
              <span className="eyebrow">
                {book ? "LEARNING BOOK" : project ? "PROJECT WALL" : character ? "CHARACTER STUDIO" : agent?.harness}
              </span>
              <h2>{book?.title ?? project?.title ?? character?.name ?? agent?.name}</h2>
              {book && <><p>{book.summary}</p>{book.sessionId && !guest && <small>Linked to {agents.find((item) => item.id === book.sessionId)?.name ?? "a session"}</small>}<span className="detail-tag"><BookOpen size={12} /> {openedBooks.length} of {visibleBooks.length} books explored</span></>}
              {project && <><p>A project pinned to this room.</p>{project.url && <a className="detail-link" href={project.url} target="_blank" rel="noreferrer">Open project <ArrowUpRight size={13} /></a>}</>}
              {!book && !project && <>
              {agent && (
                <span className={`agent-behavior ${agent.status}`}>
                  {behavior(agent)}
                  {replay?.id === agent.id ? " · recorded replay" : ""}
                </span>
              )}
              {agent && linkedPartner(agent.id) && <small>Recent recorded session link with {linkedPartner(agent.id)!.name}. The play animation shows that link, not message contents.</small>}
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
                      <div>
                        <dt>Context</dt>
                        <dd>
                          {agent.contextUsed !== null &&
                          agent.contextWindow !== null
                            ? `${Math.round((agent.contextUsed / agent.contextWindow) * 100)}%`
                            : "Not reported"}
                        </dd>
                      </div>
                      {guest?.stats?.agentTotals?.[agent.id] && <><div><dt>Total tokens</dt><dd>{guest.stats.agentTotals[agent.id].totalTokens === null ? "Not reported" : guest.stats.agentTotals[agent.id].totalTokens!.toLocaleString()}</dd></div><div><dt>Spend</dt><dd>{guest.stats.agentTotals[agent.id].totalSpend === null ? "Not reported" : `USD ${guest.stats.agentTotals[agent.id].totalSpend!.toFixed(2)}`}</dd></div></>}
                    </dl>
                    <small>
                      Source event {new Date(agent.updatedAt).toLocaleString()}
                    </small>
                    {agent.history && agent.history.length > 1 && (
                      <button
                        className="replay-button"
                        onClick={() => startReplay(agent)}
                      >
                        <Play size={13} />
                        Replay last recorded task
                      </button>
                    )}
                    {!guest && local.enabled && (
                      <small className="context-note">
                        Context is the last reported input size, not lifetime
                        usage.
                      </small>
                    )}
                  </>
                )
              )}
              </>}
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
          {guest ? `${guest.profile.displayName} · shared snapshot` : showPreview
            ? "A playground for your future team"
            : replay
              ? "Recorded task replay · no task is being executed"
              : local.enabled
                ? `${agents.length} local sessions · ${local.state} · checked ${local.observedAt ? new Date(local.observedAt).toLocaleTimeString() : "—"}`
                : `${agents.length} imported agents · snapshot mode`}
        </span>
        <span>
          Powered by Three.js <span className="footer-separator">/</span> Built
          with a little <Heart size={11} />
        </span>
      </footer>
      {!guest && studioTab && <RoomStudio key={studioTab} initialTab={studioTab} profile={profile} onProfile={setProfile} books={books} onBooks={setBooks} projects={projects} onProjects={setProjects} stats={stats} onStats={setStats} share={share} onShare={setShare} agents={visibleAgents} onClose={() => setStudioTab(null)} />}
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
                <small>Read sessions for this workspace from local Codex</small>
              </div>
              <span className="connection-status">
                {local.state === "connected" ? "Connected" : "Local only"}
              </span>
            </div>
            <button className="file-import" onClick={connectRobots}>
              <Users size={19} />
              <span>
                <b>Connect local sessions</b>
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
    </div>
  );
}
