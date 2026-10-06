import type { OfficeAgent } from "./types";

export type RoomTheme = "studio" | "grove" | "coastal" | "cosmic";
export interface RoomProfile {
  socialUrl: string;
  displayName: string;
  interests: string;
  theme: RoomTheme;
}
export interface KnowledgeBook {
  id: string;
  title: string;
  summary: string;
  sessionId: string | null;
}
export interface RoomProject {
  id: string;
  title: string;
  url: string;
}
export interface RoomStats {
  totalTokens: number | null;
  totalSpend: number | null;
  currency: string;
  agentTotals: Record<string, { totalTokens: number | null; totalSpend: number | null }>;
}
export interface ShareOptions {
  profileLink: boolean;
  agents: boolean;
  books: boolean;
  projects: boolean;
  stats: boolean;
}
export interface GuestRoom {
  version: 1;
  createdAt: string;
  profile: RoomProfile;
  agents: OfficeAgent[];
  books: KnowledgeBook[];
  projects: RoomProject[];
  stats: RoomStats | null;
}

export const EMPTY_PROFILE: RoomProfile = {
  socialUrl: "",
  displayName: "My room",
  interests: "",
  theme: "studio",
};
export const EMPTY_STATS: RoomStats = {
  totalTokens: null,
  totalSpend: null,
  currency: "USD",
  agentTotals: {},
};
export const DEFAULT_SHARE: ShareOptions = {
  profileLink: false,
  agents: false,
  books: false,
  projects: false,
  stats: false,
};

export function normalizePublicUrl(input: string): string {
  if (!input.trim()) return "";
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a complete HTTPS profile URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes("."))
    throw new Error("Enter a public HTTPS URL without credentials.");
  url.search = "";
  url.hash = "";
  const normalized = url.toString();
  if (normalized.length > 300) throw new Error("That URL is too long.");
  return normalized;
}

export function themeFromProfile(url: string, interests: string): RoomTheme {
  const words = interests.toLowerCase();
  if (/\b(space|stars|astronomy|physics|robotics|code|coding|ai)\b/.test(words)) return "cosmic";
  if (/\b(ocean|water|marine|beach|travel|surf)\b/.test(words)) return "coastal";
  if (/\b(nature|forest|garden|climate|plants|wildlife)\b/.test(words)) return "grove";
  if (!url) return "studio";
  // A URL is a visual seed only; it is never treated as scraped profile data.
  let hash = 0;
  for (const character of url) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (["studio", "grove", "coastal", "cosmic"] as const)[(hash >>> 0) % 4];
}

export function createGuestRoom(input: {
  profile: RoomProfile;
  agents: OfficeAgent[];
  books: KnowledgeBook[];
  projects: RoomProject[];
  stats: RoomStats;
  share: ShareOptions;
}): GuestRoom {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    profile: {
      ...input.profile,
      socialUrl: input.share.profileLink ? input.profile.socialUrl : "",
      interests: input.share.profileLink ? input.profile.interests : "",
    },
    agents: input.share.agents
      ? input.agents.slice(0, 50).map((agent, index) => ({
          id: `shared-${index}`,
          name: agent.name,
          harness: agent.harness,
          model: agent.model,
          status: agent.status,
          task: null,
          contextUsed: null,
          contextWindow: null,
          updatedAt: agent.updatedAt,
          ...(agent.character ? { character: agent.character } : {}),
        }))
      : [],
    books: input.share.books ? input.books.slice(0, 8).map((book) => ({ ...book, sessionId: null })) : [],
    projects: input.share.projects ? input.projects.slice(0, 8) : [],
    stats: input.share.stats ? {
      totalTokens: Number.isFinite(input.stats.totalTokens) && input.stats.totalTokens! >= 0 ? input.stats.totalTokens : null,
      totalSpend: Number.isFinite(input.stats.totalSpend) && input.stats.totalSpend! >= 0 ? input.stats.totalSpend : null,
      currency: "USD",
      agentTotals: input.share.agents ? Object.fromEntries(input.agents.slice(0, 50).map((agent, index) => {
        const totals = input.stats.agentTotals?.[agent.id];
        return [`shared-${index}`, {
          totalTokens: typeof totals?.totalTokens === "number" && Number.isFinite(totals.totalTokens) && totals.totalTokens >= 0 ? totals.totalTokens : null,
          totalSpend: typeof totals?.totalSpend === "number" && Number.isFinite(totals.totalSpend) && totals.totalSpend >= 0 ? totals.totalSpend : null,
        }];
      })) : {},
    } : null,
  };
}

function encodeRoom(room: GuestRoom): string {
  const bytes = new TextEncoder().encode(JSON.stringify(room));
  if (bytes.length > 32000) throw new Error("This room is too large for an invitation link. Share fewer items.");
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function invitationUrl(room: GuestRoom, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.hash = `room=${encodeRoom(room)}`;
  return url.toString();
}

export function readGuestRoom(hash: string): GuestRoom | null {
  const encoded = hash.startsWith("#room=") ? hash.slice(6) : "";
  if (!encoded || encoded.length > 43000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes)) as GuestRoom;
    if (value?.version !== 1 || !value.profile || !Array.isArray(value.agents) ||
        !Array.isArray(value.books) || !Array.isArray(value.projects)) return null;
    if (value.agents.length > 50 || value.books.length > 8 || value.projects.length > 8) return null;
    const theme: RoomTheme = ["studio", "grove", "coastal", "cosmic"].includes(value.profile.theme) ? value.profile.theme : "studio";
    const statuses = ["working", "idle", "blocked", "error", "offline", "unknown"];
    const characters = ["blue-dot", "frog-dot", "yellow-dot", "pink-dot", "purple-dot", "lovable"];
    const agents: OfficeAgent[] = value.agents.filter((agent) => agent &&
      typeof agent.name === "string" && typeof agent.harness === "string" &&
      typeof agent.status === "string" && statuses.includes(agent.status) &&
      agent.name.length <= 100 && agent.harness.length <= 50).map((agent, index) => ({
        id: `shared-${index}`, name: agent.name, harness: agent.harness,
        model: typeof agent.model === "string" ? agent.model.slice(0, 80) : null,
        status: agent.status, task: null, contextUsed: null, contextWindow: null,
        updatedAt: typeof agent.updatedAt === "string" && Number.isFinite(Date.parse(agent.updatedAt)) ? agent.updatedAt : new Date(0).toISOString(),
        ...(agent.character && characters.includes(agent.character) ? { character: agent.character } : {}),
      }));
    const books: KnowledgeBook[] = value.books.filter((book) => book && typeof book.title === "string" && typeof book.summary === "string").map((book, index) => ({
      id: `book-${index}`, title: book.title.slice(0, 70), summary: book.summary.slice(0, 700), sessionId: null,
    }));
    const projects: RoomProject[] = value.projects.filter((project) => project && typeof project.title === "string" && typeof project.url === "string").flatMap((project, index) => {
      try { return [{ id: `project-${index}`, title: project.title.slice(0, 70), url: normalizePublicUrl(project.url) }]; }
      catch { return []; }
    });
    const stats = value.stats && typeof value.stats === "object" ? {
      totalTokens: typeof value.stats.totalTokens === "number" && Number.isFinite(value.stats.totalTokens) && value.stats.totalTokens >= 0 ? value.stats.totalTokens : null,
      totalSpend: typeof value.stats.totalSpend === "number" && Number.isFinite(value.stats.totalSpend) && value.stats.totalSpend >= 0 ? value.stats.totalSpend : null,
      currency: "USD",
      agentTotals: Object.fromEntries(agents.map((agent) => {
        const totals = value.stats?.agentTotals?.[agent.id];
        return [agent.id, {
          totalTokens: typeof totals?.totalTokens === "number" && Number.isFinite(totals.totalTokens) && totals.totalTokens >= 0 ? totals.totalTokens : null,
          totalSpend: typeof totals?.totalSpend === "number" && Number.isFinite(totals.totalSpend) && totals.totalSpend >= 0 ? totals.totalSpend : null,
        }];
      })),
    } : null;
    return {
      version: 1,
      createdAt: typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) ? value.createdAt : new Date(0).toISOString(),
      profile: {
        socialUrl: typeof value.profile.socialUrl === "string" ? normalizePublicUrl(value.profile.socialUrl) : "",
        displayName: typeof value.profile.displayName === "string" ? value.profile.displayName.slice(0, 50) : "Shared room",
        interests: typeof value.profile.interests === "string" ? value.profile.interests.slice(0, 180) : "",
        theme,
      }, agents, books, projects, stats,
    };
  } catch {
    return null;
  }
}
