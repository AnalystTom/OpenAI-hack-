import { useState, type FormEvent } from "react";
import { BookOpen, Check, Copy, ExternalLink, FileUp, Palette, Plus, Share2, Trash2, X } from "lucide-react";
import type { OfficeAgent } from "../types";
import SocialImporter from "./SocialImporter";
import {
  createGuestRoom, EMPTY_PROFILE, invitationUrl, normalizePublicUrl, readGuestRoom, themeFromProfile,
  type KnowledgeBook, type RoomProfile, type RoomProject, type RoomStats,
  type RoomTheme, type ShareOptions,
} from "../socialRoom";

type Tab = "profile" | "social" | "library" | "projects" | "invite";
const THEMES: { id: RoomTheme; name: string }[] = [
  { id: "studio", name: "Creative studio" },
  { id: "grove", name: "Garden room" },
  { id: "coastal", name: "Coastal room" },
  { id: "cosmic", name: "Night lab" },
];

export default function RoomStudio({
  initialTab, profile, onProfile, books, onBooks, projects, onProjects,
  stats, onStats, share, onShare, agents, onClose,
}: {
  initialTab: Tab;
  profile: RoomProfile;
  onProfile: (profile: RoomProfile) => void;
  books: KnowledgeBook[];
  onBooks: (books: KnowledgeBook[]) => void;
  projects: RoomProject[];
  onProjects: (projects: RoomProject[]) => void;
  stats: RoomStats;
  onStats: (stats: RoomStats) => void;
  share: ShareOptions;
  onShare: (share: ShareOptions) => void;
  agents: OfficeAgent[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [socialUrl, setSocialUrl] = useState(profile.socialUrl);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [interests, setInterests] = useState(profile.interests);
  const [theme, setTheme] = useState<RoomTheme>(profile.theme);
  const [bookTitle, setBookTitle] = useState("");
  const [bookSummary, setBookSummary] = useState("");
  const [bookSession, setBookSession] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [invite, setInvite] = useState("");
  const [friendLink, setFriendLink] = useState("");
  const [message, setMessage] = useState("");

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    try {
      onProfile({ socialUrl: normalizePublicUrl(socialUrl), displayName: displayName.trim().slice(0, 50) || "My room", interests: interests.trim().slice(0, 180), theme });
      setMessage("Your room has a new look.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    }
  }
  function suggestTheme() {
    setTheme(themeFromProfile("", interests));
    setMessage("Theme suggested from the interests you entered.");
  }
  function applySocialImport(next: RoomProfile, platform: "linkedin" | "x") {
    onProfile(next);
    setSocialUrl(next.socialUrl);
    setDisplayName(next.displayName);
    setInterests(next.interests);
    setTheme(next.theme);
    setTab("profile");
    setMessage(`${platform === "linkedin" ? "LinkedIn" : "X"} information added to your room. You can fine-tune the look here.`);
  }
  function removeSocialImport() {
    onProfile(EMPTY_PROFILE);
    setSocialUrl("");
    setDisplayName(EMPTY_PROFILE.displayName);
    setInterests("");
    setTheme(EMPTY_PROFILE.theme);
    setMessage("Imported profile details removed from your room.");
  }
  function addBook(event: FormEvent) {
    event.preventDefault();
    if (!bookTitle.trim() || !bookSummary.trim()) return setMessage("Add a title and a real learning summary.");
    if (books.length >= 8) return setMessage("This room holds eight books for now.");
    onBooks([...books, { id: crypto.randomUUID(), title: bookTitle.trim().slice(0, 70), summary: bookSummary.trim().slice(0, 700), sessionId: bookSession || null }]);
    setBookTitle(""); setBookSummary(""); setBookSession(""); setMessage("A book joined your room.");
  }
  function addProject(event: FormEvent) {
    event.preventDefault();
    if (!projectTitle.trim()) return setMessage("Give the project a title.");
    if (projects.length >= 8) return setMessage("This wall holds eight projects for now.");
    try {
      onProjects([...projects, { id: crypto.randomUUID(), title: projectTitle.trim().slice(0, 70), url: normalizePublicUrl(projectUrl) }]);
      setProjectTitle(""); setProjectUrl(""); setMessage("Project added to your wall.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add project.");
    }
  }
  function makeInvite() {
    try {
      const room = createGuestRoom({ profile, agents, books, projects, stats, share });
      setInvite(invitationUrl(room, window.location.href));
      setMessage("Invitation ready. It contains only the categories selected below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create invitation.");
    }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite); setMessage("Invitation link copied."); }
    catch { setMessage("Copy the link from the field below."); }
  }
  function visitFriend() {
    try {
      const url = new URL(friendLink.trim());
      if (url.origin !== window.location.origin || !readGuestRoom(url.hash)) throw new Error("Paste a valid invitation for this site.");
      window.location.hash = url.hash;
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open that invitation.");
    }
  }
  function setAgentTotal(id: string, field: "totalTokens" | "totalSpend", raw: string) {
    const current = stats.agentTotals?.[id] ?? { totalTokens: null, totalSpend: null };
    onStats({ ...stats, agentTotals: { ...stats.agentTotals, [id]: { ...current, [field]: raw === "" ? null : Number(raw) } } });
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal room-studio" role="dialog" aria-modal="true" aria-labelledby="studio-title" onClick={(event) => event.stopPropagation()}>
        <button className="close" aria-label="Close room studio" onClick={onClose}><X size={18} /></button>
        <div className="eyebrow">MAKE THE ROOM YOURS</div>
        <h2 id="studio-title">Room studio</h2>
        <p className="studio-intro">Shape your world from your own interests, shelve what you learned, and invite friends into a snapshot you choose to share.</p>
        <nav className="studio-tabs" aria-label="Room studio sections">
          <button className={tab === "profile" ? "active" : ""} onClick={() => { setTab("profile"); setMessage(""); }}><Palette size={15} /> Look</button>
          <button className={tab === "social" ? "active" : ""} onClick={() => { setTab("social"); setMessage(""); }}><FileUp size={15} /> Social import</button>
          <button className={tab === "library" ? "active" : ""} onClick={() => { setTab("library"); setMessage(""); }}><BookOpen size={15} /> Books</button>
          <button className={tab === "projects" ? "active" : ""} onClick={() => { setTab("projects"); setMessage(""); }}>Projects</button>
          <button className={tab === "invite" ? "active" : ""} onClick={() => { setTab("invite"); setMessage(""); }}><Share2 size={15} /> Invite</button>
        </nav>
        {tab === "profile" && <form className="studio-form" onSubmit={saveProfile}>
          <div className="linked-social"><span>{socialUrl ? `Linked profile: ${socialUrl}` : interests ? "Room look based on your interests" : "No social profile imported yet"}</span><button type="button" className="quiet-button" onClick={() => { setTab("social"); setMessage(""); }}>{socialUrl ? "Change import" : "Import LinkedIn or X"}</button>{socialUrl && <button type="button" className="quiet-button" onClick={removeSocialImport}>Remove import</button>}</div>
          <label>Room name<input maxLength={50} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label>Interests or bio keywords<input maxLength={180} placeholder="e.g. ocean science, design, robotics" value={interests} onChange={(event) => setInterests(event.target.value)} /></label>
          <div className="theme-row">{THEMES.map((option) => <button type="button" key={option.id} className={`theme-choice ${theme === option.id ? "active" : ""} theme-${option.id}`} onClick={() => setTheme(option.id)}>{option.name}</button>)}</div>
          <div className="studio-actions"><button type="button" className="quiet-button" onClick={suggestTheme}>Suggest from interests</button><button type="submit" className="import-button">Apply to room</button></div>
        </form>}
        {tab === "social" && <SocialImporter profile={profile} onApply={applySocialImport} />}
        {tab === "library" && <div className="studio-form">
          <p className="field-note">Each book is a summary you provide from an agent session. We never guess what a session taught you from its title.</p>
          <div className="studio-list">{books.length ? books.map((book) => <div className="studio-list-item" key={book.id}><BookOpen size={18} /><span><b>{book.title}</b><small>{book.summary}</small></span><button aria-label={`Remove ${book.title}`} onClick={() => onBooks(books.filter((item) => item.id !== book.id))}><Trash2 size={15} /></button></div>) : <p className="studio-empty">Your library is ready for its first discovery.</p>}</div>
          <form onSubmit={addBook}>
            <label>Topic<input maxLength={70} value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="What did you learn?" /></label>
            <label>Summary<textarea maxLength={700} rows={3} value={bookSummary} onChange={(event) => setBookSummary(event.target.value)} placeholder="A few true sentences from the session" /></label>
            {agents.length > 0 && <label>Link to a session<select value={bookSession} onChange={(event) => setBookSession(event.target.value)}><option value="">No session linked</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>}
            <button className="import-button" type="submit"><Plus size={15} /> Add book</button>
          </form>
        </div>}
        {tab === "projects" && <div className="studio-form">
          <p className="field-note">Pin projects you actually built. Your friends see them only when you share this category.</p>
          <div className="studio-list">{projects.length ? projects.map((project) => <div className="studio-list-item" key={project.id}><span><b>{project.title}</b><small>{project.url || "No link"}</small></span><button aria-label={`Remove ${project.title}`} onClick={() => onProjects(projects.filter((item) => item.id !== project.id))}><Trash2 size={15} /></button></div>) : <p className="studio-empty">No projects pinned yet.</p>}</div>
          <form onSubmit={addProject}><label>Project name<input maxLength={70} value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} /></label><label>Project URL, optional<input type="url" placeholder="https://..." value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} /></label><button className="import-button" type="submit"><Plus size={15} /> Pin project</button></form>
        </div>}
        {tab === "invite" && <div className="studio-form">
          <p className="field-note">Invitations are read-only snapshots carried in the link. Anyone with the link can view the categories you select. They do not update live.</p>
          <fieldset className="share-options"><legend>What may a friend see?</legend>{([
            ["profileLink", "Social profile link and interests"], ["agents", "Agent names, models, and statuses"], ["books", "Learning books"], ["projects", "Project wall"], ["stats", "Token and spending totals"],
          ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={share[key]} onChange={(event) => onShare({ ...share, [key]: event.target.checked })} />{label}</label>)}</fieldset>
          <div className="stats-fields"><label>Total tokens, if known<input type="number" min="0" placeholder="Not reported" value={stats.totalTokens ?? ""} onChange={(event) => onStats({ ...stats, totalTokens: event.target.value === "" ? null : Number(event.target.value) })} /></label><label>Total spend, if known<input type="number" min="0" step="0.01" placeholder="Not reported" value={stats.totalSpend ?? ""} onChange={(event) => onStats({ ...stats, totalSpend: event.target.value === "" ? null : Number(event.target.value) })} /></label></div>
          {agents.length > 0 && <details className="agent-cost-editor"><summary>Per-agent token and spending totals</summary><p className="field-note">Enter reported lifetime totals. They appear in a friend's agent details only when both agents and stats are shared.</p>{agents.slice(0, 12).map((agent) => <div className="agent-cost-row" key={agent.id}><b>{agent.name}</b><label>Tokens<input type="number" min="0" placeholder="Unknown" value={stats.agentTotals?.[agent.id]?.totalTokens ?? ""} onChange={(event) => setAgentTotal(agent.id, "totalTokens", event.target.value)} /></label><label>Spend (USD)<input type="number" min="0" step="0.01" placeholder="Unknown" value={stats.agentTotals?.[agent.id]?.totalSpend ?? ""} onChange={(event) => setAgentTotal(agent.id, "totalSpend", event.target.value)} /></label></div>)}</details>}
          <p className="field-note">Totals are entered by you. Current context occupancy is not a lifetime token or cost total.</p>
          <button className="import-button" onClick={makeInvite}><Share2 size={15} /> Create invitation</button>
          {invite && <div className="invite-link"><input aria-label="Invitation link" readOnly value={invite} onFocus={(event) => event.target.select()} /><button aria-label="Copy invitation" onClick={copyInvite}><Copy size={16} /></button></div>}
          <div className="friend-entry"><b>Visit a friend's room</b><div><input type="url" placeholder="Paste their invitation link" value={friendLink} onChange={(event) => setFriendLink(event.target.value)} /><button className="quiet-button" onClick={visitFriend}><ExternalLink size={15} /> Visit</button></div></div>
        </div>}
        {message && <p className="studio-message" role="status"><Check size={14} />{message}</p>}
      </section>
    </div>
  );
}
