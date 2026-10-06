import { normalizePublicUrl, themeFromProfile, type RoomProfile } from "./socialRoom.ts";

export type SocialPlatform = "linkedin" | "x";
export interface SocialImportFile { name: string; text: string }
export interface SocialImportPreview {
  profile: RoomProfile;
  platform: SocialPlatform;
  sources: string[];
  details: string[];
}

const clean = (value: unknown, limit = 400) => typeof value === "string"
  ? value.replace(/<[^>]*>/g, " ").replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ")
    .replace(/@[a-zA-Z0-9_]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, limit)
  : "";

export function normalizeSocialProfileUrl(platform: SocialPlatform, input: string): string {
  if (!input.trim()) return "";
  const value = normalizePublicUrl(input);
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (platform === "linkedin") {
    if (!["linkedin.com", "www.linkedin.com"].includes(host) || !/^\/in\/[^/]+\/?$/.test(url.pathname))
      throw new Error("Use a LinkedIn member URL such as https://www.linkedin.com/in/your-name/.");
  } else if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(host) ||
    !/^\/[a-zA-Z0-9_]{1,15}\/?$/.test(url.pathname) ||
    ["home", "explore", "search", "settings", "i", "intent", "messages"].includes(url.pathname.split("/")[1].toLowerCase())) {
    throw new Error("Use an X profile URL such as https://x.com/yourhandle.");
  }
  return value;
}

function csvRows(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const character = source[i];
    if (character === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[i + 1] === "\n") i++;
      row.push(field); if (row.some((cell) => cell.trim())) rows.push(row);
      row = []; field = "";
    } else field += character;
  }
  row.push(field); if (row.some((cell) => cell.trim())) rows.push(row);
  const headers = (rows.shift() ?? []).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return rows.slice(0, 50).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function archiveJson(text: string): unknown {
  const source = text.trim().replace(/^window\.YTD\.[a-zA-Z0-9_.]+\s*=\s*/, "").replace(/;\s*$/, "");
  try { return JSON.parse(source); }
  catch { throw new Error("That social export is not valid JSON or archive JavaScript."); }
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object").slice(0, 50) :
    value && typeof value === "object" ? [value as Record<string, unknown>] : [];
}

export function previewSocialImport(input: {
  platform: SocialPlatform;
  url: string;
  pastedText: string;
  files: SocialImportFile[];
}): SocialImportPreview {
  if (input.files.length > 5 || input.files.reduce((sum, file) => sum + file.text.length, 0) > 8_000_000)
    throw new Error("Choose up to five small profile files, 8 MB total.");
  const socialUrl = normalizeSocialProfileUrl(input.platform, input.url);
  const sources: string[] = [];
  const details: string[] = [];
  const headline: string[] = [];
  const skills: string[] = [];
  const posts: string[] = [];
  let name = "";
  let bio = "";
  let handle = socialUrl ? decodeURIComponent(new URL(socialUrl).pathname.split("/").filter(Boolean).at(-1) ?? "") : "";
  if (input.pastedText.trim()) {
    bio = clean(input.pastedText, 900);
    sources.push("Pasted profile text");
  }
  for (const file of input.files) {
    const filename = file.name.toLowerCase();
    if (input.platform === "linkedin") {
      if (!["profile.csv", "skills.csv", "positions.csv", "projects.csv"].includes(filename))
        throw new Error("For LinkedIn, choose Profile.csv, Skills.csv, Positions.csv, or Projects.csv from your export.");
      const rows = csvRows(file.text);
      if (filename === "profile.csv" && rows[0]) {
        const profile = rows[0];
        name = clean([profile.firstname, profile.lastname].filter(Boolean).join(" "), 50) || name;
        headline.push(clean(profile.headline ?? profile.industry, 150));
        bio ||= clean(profile.summary ?? profile.about, 400);
      }
      if (filename === "skills.csv") skills.push(...rows.map((row) => clean(row.name ?? row.skill, 40)).filter(Boolean).slice(0, 12));
      if (filename === "positions.csv") headline.push(...rows.map((row) => clean(row.title, 70)).filter(Boolean).slice(0, 3));
      if (filename === "projects.csv") headline.push(...rows.map((row) => clean(row.title ?? row.name, 70)).filter(Boolean).slice(0, 3));
      if (rows.length) sources.push(file.name);
    } else {
      if (!["account.js", "profile.js", "tweets.js", "tweet.js", "account.json", "profile.json", "tweets.json", "tweet.json"].includes(filename))
        throw new Error("For X, choose account.js, profile.js, or tweets.js from your archive.");
      const records = list(archiveJson(file.text));
      for (const record of records) {
        const account = (record.account ?? record) as Record<string, unknown>;
        const profile = (record.profile ?? record) as Record<string, unknown>;
        const tweet = (record.tweet ?? record) as Record<string, unknown>;
        if (filename.startsWith("account")) {
          name ||= clean(account.accountDisplayName ?? account.name, 50);
          handle ||= clean(account.username, 30);
        }
        if (filename.startsWith("profile")) {
          const description = profile.description as Record<string, unknown> | undefined;
          bio ||= clean(description?.bio ?? profile.bio ?? profile.description, 400);
          name ||= clean(profile.name, 50);
        }
        if (filename.startsWith("tweet") && posts.length < 20)
          posts.push(clean(tweet.full_text ?? tweet.text, 250));
      }
      if (records.length) sources.push(file.name);
    }
  }
  const hashtags = [...posts.join(" ").matchAll(/#([a-zA-Z][a-zA-Z0-9_]{1,24})/g)]
    .map((match) => match[1].replaceAll("_", " "));
  const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  const topics = unique([bio, ...headline, ...skills.slice(0, 6), ...hashtags.slice(0, 5)]);
  if (!topics.length) throw new Error("Add profile text or selected export files. A URL alone cannot reveal your bio or interests.");
  if (headline.some(Boolean)) details.push("Headline or roles found");
  if (skills.length) details.push(`${skills.length} skills found`);
  if (posts.some(Boolean)) details.push(`${posts.filter(Boolean).length} posts scanned for topics`);
  const interests = topics.join(" · ").slice(0, 180);
  return {
    platform: input.platform,
    sources,
    details,
    profile: {
      socialUrl,
      displayName: name || clean(handle.replace(/[-_]/g, " "), 50) || "My room",
      interests,
      theme: themeFromProfile("", topics.join(" ")),
    },
  };
}
