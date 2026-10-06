import { FirstAidPanel } from "./components/FirstAidPanel";
import { AgentVitals } from "./components/AgentVitals";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  ChevronRight,
  CircleHelp,
  Coffee,
  Globe2,
  Heart,
  HeartPulse,
  Maximize,
  Moon,
  MousePointer2,
  BookOpen,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import OfficeWorld, { CHARACTERS } from "./components/OfficeWorld";
import type { AgentInteraction, OfficeAgent } from "./types";
import {
  createOfficeReplay,
  appendOfficeReplay,
  agentActivityLabel,
  replayOffice,
  officeSummary,
  replayClockLabel,
  type OfficeReplay,
} from "./officeReplay";
import { agentCharacter, STATUS_LABELS, liveInteractions } from "./officeBehavior";
import { useRobotsSessions } from "./integrations/codex/useRobotsSessions";
import Welcome from "./components/import/Welcome";
import { mergeOfficeAgents, readSavedOffice, serializeOffice, OFFICE_STORAGE_KEY, ENTERED_STORAGE_KEY } from "./officeStore";

import RoomStudio from "./components/RoomStudio";
import projectExampleSource from "./data/project-example.json";
import { parseOfficeSnapshot } from "./snapshot";
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
const projectExample = parseOfficeSnapshot(JSON.stringify(projectExampleSource));

export default function App() {
  const [saved] = useState(() => {
    try { return readSavedOffice(localStorage); }
    catch { return { agents: [], interactions: [], error: "Browser storage is unavailable. Your office cannot be saved on this device." }; }
  });
  const showProjectExampleInitially = import.meta.env.PROD && !saved.agents.length && !window.location.hash && projectExample.agents.length > 0;
  const [welcome, setWelcome] = useState(() => {
    if (showProjectExampleInitially) return false;
    try { return localStorage.getItem(ENTERED_STORAGE_KEY) !== "yes"; } catch { return true; }
  });
  const [agents, setAgents] = useState<OfficeAgent[]>(saved.agents);
  const agentsRef = useRef(agents);
  const showProjectExample = showProjectExampleInitially && agents.length === 0;
  const [officeError, setOfficeError] = useState(saved.error);
  const [interactions, setInteractions] = useState<AgentInteraction[]>(() => showProjectExampleInitially ? projectExample.interactions ?? [] : saved.interactions);
  const [interactionClock, setInteractionClock] = useState(Date.now());
  const [preview, setPreview] = useState(
    () => !showProjectExampleInitially && !saved.agents.length && sessionStorage.getItem("dots-robots-connected") !== "yes",
  );
  const [paused, setPaused] = useState(false);
  const [night, setNight] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [firstAid, setFirstAid] = useState(false);
  const firstAidButton = useRef<HTMLButtonElement>(null);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);
  const [studioTab, setStudioTab] = useState<"profile" | "social" | "library" | "projects" | "invite" | null>(null);
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
  const office = useRef<HTMLDivElement>(null);
  const showPreview = !guest && preview;
  const visibleProfile = guest?.profile ?? profile;
  const visibleBooks = guest?.books ?? books;
  const visibleProjects = guest?.projects ?? projects;
  const character = !guest ? CHARACTERS.find((c) => c.kind === selected) : undefined;
  function addAgents(incoming: OfficeAgent[], incomingLinks: AgentInteraction[] = []) {
    const merged = mergeOfficeAgents(agentsRef.current, incoming);
    const links = [...new Map([...interactions, ...incomingLinks].map((link) => [
      `${link.fromId}:${link.toId}:${link.at}:${link.kind}`, link,
    ])).values()].filter((link) => merged.some((a) => a.id === link.fromId) && merged.some((a) => a.id === link.toId)).slice(-100);
    try { localStorage.setItem(OFFICE_STORAGE_KEY, serializeOffice(merged, links)); }
    catch { throw new Error("This browser could not save the office. Free some browser storage and try importing again."); }
    agentsRef.current = merged;
    setAgents(merged);
    setInteractions(links);
    setOfficeError("");
    return merged;
  }
  function dismissWelcome() {
    setWelcome(false);
    try { localStorage.setItem(ENTERED_STORAGE_KEY, "yes"); }
    catch { setOfficeError("Browser storage is unavailable. The welcome card will reappear on refresh."); }
  }
  const local = useRobotsSessions((snapshot) => {
    autoStartReplay.current = false;
    setInteractions(snapshot.interactions ?? []);
    setInteractionClock(Date.now());
    const incoming = snapshot.agents;
    if (!incoming.length) return;
    try { addAgents(incoming); } catch (e) { setOfficeError(e instanceof Error ? e.message : "Unable to save office."); }
  });
  const [replay, setReplay] = useState<OfficeReplay | null>(() => showProjectExampleInitially ? createOfficeReplay(projectExample.agents) : null);
  const [replayElapsed, setReplayElapsed] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const autoStartReplay = useRef(true);
  function startOfficeReplay(source = showProjectExample ? projectExample.agents : agents) {
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
    : (showProjectExample ? projectExample.agents : agents).map((a) =>
        local.enabled && local.state === "error"
          ? { ...a, status: "offline" as const }
          : a,
      );
  const summary = officeSummary(visibleAgents, !!replay);
  useEffect(() => {
    if (!interactions.length) return;
    const timer = setInterval(() => setInteractionClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [interactions.length]);
  const roomAgents = guest?.agents ?? visibleAgents;
  const activeLinks = guest || showPreview || replay || (local.enabled && local.state !== "connected")
    ? [] : liveInteractions(roomAgents, interactions, interactionClock);
  const linkedPartner = (id: string) => {
    const link = activeLinks.find((item) => item.fromId === id || item.toId === id);
    return link && roomAgents.find((item) => item.id === (link.fromId === id ? link.toId : link.fromId));
  };
  const agent = roomAgents.find((a) => a.id === selected);
  const book = visibleBooks.find((item) => item.id === selectedBook);
  const project = visibleProjects.find((item) => item.id === selectedProject);
  function openFirstAid() { setSelected(null); setSelectedBook(null); setSelectedProject(null); setFirstAid(true); }
  function selectAgent(id: string) { setFirstAid(false); setSelected(id); setSelectedBook(null); setSelectedProject(null); }
  function selectBook(id: string) { setFirstAid(false); setSelected(null); setSelectedProject(null); setSelectedBook(id); setOpenedBooks((current) => current.includes(id) ? current : [...current, id]); }
  function selectProject(id: string) { setFirstAid(false); setSelected(null); setSelectedBook(null); setSelectedProject(id); }
  function leaveGuest() { window.location.hash = ""; setGuest(null); }
  function joinGuest() {
    if (!guest) return;
    try {
      const incoming = guest.agents.map((a) => ({ ...a, id: `invite:${guest.createdAt}:${a.id}` }));
      const merged = addAgents(incoming);
      local.disconnect();
      autoStartReplay.current = false;
      setPreview(false);
      setPaused(false);
      if (replay && !showProjectExample) setReplay(appendOfficeReplay(replay, incoming, replayElapsed));
      else startOfficeReplay(merged);
      leaveGuest();
      dismissWelcome();
    } catch (e) { setOfficeError(e instanceof Error ? e.message : "Unable to join this snapshot."); }
  }
  const behavior = (a: OfficeAgent) => linkedPartner(a.id) ? `Working with ${linkedPartner(a.id)!.name}` : agentActivityLabel(a) ?? STATUS_LABELS[a.status];
  function watchLocal(source: string) {
    autoStartReplay.current = false;
    setReplay(null);
    setSelected(null);
    setPreview(false);
    setWelcome(false);
    setPaused(false);
    local.connect(source);
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
        {guest ? <nav aria-label="Shared room"><span className="guest-nav-label">Visiting {guest.profile.displayName}</span><button onClick={leaveGuest}>Back to my room</button></nav> : <nav aria-label="Office views">
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
            Your agents {roomAgents.length > 0 && <small>{roomAgents.length}</small>}
          </button>
        </nav>}
        <div className="topbar-actions">
          {guest && <button className="import-button" onClick={joinGuest}><Users size={15} /> Join snapshot with my agents</button>}
          {!guest && <button className="studio-button" onClick={() => setStudioTab("profile")}><Palette size={15} /> Room studio</button>}
          {!guest && <button className="studio-button social-top-button" title="Import LinkedIn or X" onClick={() => setStudioTab("social")}><Globe2 size={15} /> Import social</button>}
          {!guest && <button className="import-button" onClick={() => setWelcome(true)}><ArrowDownToLine size={15} /> Import agents</button>}
        </div>
      </header>
      <main>
        <aside className={`sidebar ${guest ? "guest-sidebar" : ""}`}>
          <div className="eyebrow"><span /> {guest ? "FRIEND'S ROOM" : "A NEW WAY TO WORK"}</div>
          <h1>{guest ? guest.profile.displayName : profile.displayName === "My room" ? <>Big ideas.<br />Little coworkers<span>.</span></> : <>{profile.displayName}<span>.</span></>}</h1>
          <p className="intro">{guest ? "Join combines these shared agents with yours in this browser. Changes are not sent to the host." : profile.interests || "Bring your Codex sessions into a little 3D office. See their activity, replay their work, and make the room yours."}</p>
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
                              agentCharacter(a.id)),
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
              {!guest && <button onClick={() => setWelcome(true)}>Bring your agents <ArrowUpRight size={14} /></button>}
            </div>
          )}
          <div className="room-collections">
            <button onClick={() => guest ? visibleBooks[0] && selectBook(visibleBooks[0].id) : setStudioTab("library")}><BookOpen size={15} /><span>Learning library</span><b>{visibleBooks.length}</b></button>
            {visibleBooks.length > 0 && <small>{openedBooks.filter((id) => visibleBooks.some((item) => item.id === id)).length} of {visibleBooks.length} books explored</small>}
            <button onClick={() => guest ? visibleProjects[0] && selectProject(visibleProjects[0].id) : setStudioTab("projects")}><Sparkles size={15} /><span>Project wall</span><b>{visibleProjects.length}</b></button>
          </div>
          {guest?.stats && <div className="friend-stats"><b>Shared totals</b><span>Tokens <strong>{guest.stats.totalTokens === null ? "Not shared" : guest.stats.totalTokens.toLocaleString()}</strong></span><span>Spend <strong>{guest.stats.totalSpend === null ? "Not shared" : `${guest.stats.currency} ${guest.stats.totalSpend.toFixed(2)}`}</strong></span><small>Owner-entered snapshot</small></div>}
          <div className="sidebar-bottom">
            {!guest && import.meta.env.DEV && <div className="local-source-controls">
              <label htmlFor="local-source">Watch local Codex sessions</label>
              <select id="local-source" value={local.enabled ? local.source : ""} onChange={(e) => watchLocal(e.target.value)}>
                <option value="" disabled>Choose a source</option>
                <option value="workspace">Current workspace</option>
                <option value="robots">Robots sessions</option>
                <option value="demo">Six Luna demo sessions</option>
                <option value="design">Design Codex session replay</option>
              </select>
              {local.enabled && <button onClick={() => { setReplay(null); setPaused(false); }}>Watch live status</button>}
            </div>}
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
                    // Disconnecting the feed keeps the saved residents.
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
          {officeError && <p className="office-error" role="alert">{officeError}</p>}
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
            onFirstAid={guest ? undefined : openFirstAid}
            onReady={() => setReady(true)}
          />
          {!guest && !showPreview &&
            local.enabled &&
            local.state === "loading" &&
            !agents.length && (
              <div className="connection-banner" role="status">
                Reading your Codex sessions…
              </div>
            )}
          {!guest && !showPreview && !replay && local.error && (
            <div className="connection-banner error" role="alert">
              {local.error}
            </div>
          )}
          {!guest && !showPreview && replay && (
            <div className="replay-banner" role="status">
              <b>{showProjectExample ? "Recorded project sessions" : "Parallel session replay"}</b>
              {showProjectExample && <span>{projectExample.agents.length} real sessions · recorded activity</span>}
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
                Show latest snapshot
              </button>
            </div>
          )}
          {!guest && !showPreview && visibleAgents.length > 0 && (
            <section className="office-summary" aria-label="Office summary">
              <span>{replay ? "REPLAY" : "IN THE OFFICE"}</span>
              <p>{summary}</p>
            </section>
          )}
          {!guest && !showPreview && !replay && visibleAgents.some((a) => (a.history?.length ?? 0) > 1) && (
            <button className="replay-entry" onClick={() => startOfficeReplay()}>Replay all sessions together</button>
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
          {!guest && !showPreview && !roomAgents.length && (
            <div className="world-empty">
              <span className="empty-icon">
                <Users size={22} />
              </span>
              <h2>Your team belongs here.</h2>
              <p>Connect the dots. Start with your agents.</p>
              <button className="import-button" onClick={() => setWelcome(true)}>
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
                Live positions follow recorded session state. Play appears only after a recent recorded link between two working sessions.
              </small>
            </div>
          )}
          {firstAid && !guest && <FirstAidPanel onClose={() => { setFirstAid(false); firstAidButton.current?.focus(); }} />}
          {!firstAid && (character || agent || book || project) && (
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
                  {replay ? " · recorded replay" : ""}
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
                      {guest?.stats?.agentTotals?.[agent.id] && <><div><dt>Total tokens</dt><dd>{guest.stats.agentTotals[agent.id].totalTokens === null ? "Not reported" : guest.stats.agentTotals[agent.id].totalTokens!.toLocaleString()}</dd></div><div><dt>Spend</dt><dd>{guest.stats.agentTotals[agent.id].totalSpend === null ? "Not reported" : `USD ${guest.stats.agentTotals[agent.id].totalSpend!.toFixed(2)}`}</dd></div></>}
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
              {!guest && <>
                <button ref={firstAidButton} aria-label="Open first-aid station" title="First-aid station" onClick={openFirstAid}>
                  <HeartPulse size={17} />
                </button>
                <span />
              </>}
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
                        setOfficeError("Fullscreen is unavailable in this browser."),
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
                ? `${agents.length} Codex sessions · ${local.state} · checked ${local.observedAt ? new Date(local.observedAt).toLocaleTimeString() : "—"}`
                : `${agents.length} imported agents · snapshot mode`}
        </span>
        <span>
          Powered by Three.js <span className="footer-separator">/</span> Built
          with a little <Heart size={11} />
        </span>
      </footer>
      {!guest && studioTab && <RoomStudio key={studioTab} initialTab={studioTab} profile={profile} onProfile={setProfile} books={books} onBooks={setBooks} projects={projects} onProjects={setProjects} stats={stats} onStats={setStats} share={share} onShare={setShare} agents={visibleAgents} onClose={() => setStudioTab(null)} />}
      {welcome && !guest && <Welcome existingCount={agents.length} onExplore={dismissWelcome} onSocialImport={() => { dismissWelcome(); setStudioTab("social"); }} onImport={(imported, importedLinks) => {
        const merged = addAgents(imported, importedLinks);
        setInteractionClock(Date.now());
        local.disconnect();
        autoStartReplay.current = false;
        setPreview(false);
        setPaused(false);
        if (replay && !showProjectExample) setReplay(appendOfficeReplay(replay, imported, replayElapsed));
        else startOfficeReplay(merged);
        dismissWelcome();
      }} />}

    </div>
  );
}
