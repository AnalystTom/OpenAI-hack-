import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGuestRoom, DEFAULT_SHARE, EMPTY_STATS, invitationUrl,
  normalizePublicUrl, readGuestRoom, themeFromProfile,
} from "../src/socialRoom.ts";

const profile = { socialUrl: "https://www.linkedin.com/in/example/", displayName: "Example room", interests: "ocean design", theme: "coastal" };
const agent = { id: "private-session-id", name: "Build task", harness: "Codex", model: "gpt-6", status: "working", task: "private task text", contextUsed: 45000, contextWindow: 100000, updatedAt: "2026-10-06T18:00:00Z" };
const book = { id: "book-1", title: "Currents", summary: "A real summary", sessionId: agent.id };
const project = { id: "project-1", title: "Explorer", url: "https://example.org/project" };
const stats = { ...EMPTY_STATS, totalTokens: 200000, totalSpend: 12.5, agentTotals: { [agent.id]: { totalTokens: 80000, totalSpend: 4.25 } } };
const input = { profile, agents: [agent], books: [book], projects: [project], stats };

test("normalizes only public HTTPS links and treats URL as a visual seed", () => {
  assert.equal(normalizePublicUrl("https://www.linkedin.com/in/example/?tracking=1#about"), profile.socialUrl);
  for (const url of ["http://linkedin.com/in/example", "javascript:alert(1)", "https://name:secret@example.com/"])
    assert.throws(() => normalizePublicUrl(url));
  assert.equal(themeFromProfile(profile.socialUrl, "ocean design"), "coastal");
});

test("invitation excludes all optional categories until owner opts in", () => {
  const room = createGuestRoom({ ...input, share: DEFAULT_SHARE });
  assert.equal(room.profile.socialUrl, "");
  assert.equal(room.profile.interests, "");
  assert.deepEqual(room.agents, []);
  assert.deepEqual(room.books, []);
  assert.deepEqual(room.projects, []);
  assert.equal(room.stats, null);
});

test("guest link contains only chosen summaries and sanitized agent totals", () => {
  const room = createGuestRoom({ ...input, share: { profileLink: true, agents: true, books: true, projects: true, stats: true } });
  const link = invitationUrl(room, "https://dots.example/app");
  const guest = readGuestRoom(new URL(link).hash);
  assert.ok(guest);
  assert.equal(guest.agents[0].id, "shared-0");
  assert.equal(guest.agents[0].task, null);
  assert.equal(guest.agents[0].contextUsed, null);
  assert.equal(guest.books[0].sessionId, null);
  assert.equal(guest.stats.agentTotals["shared-0"].totalSpend, 4.25);
  assert.equal(link.includes(agent.id), false);
  assert.equal(link.includes(agent.task), false);
});

test("invalid or hostile guest payloads are rejected or sanitized", () => {
  assert.equal(readGuestRoom("#room=bad!"), null);
  const bad = { version: 1, createdAt: "bad", profile: { socialUrl: "", displayName: "Guest", interests: "", theme: "wrong" }, agents: [{ status: "working" }], books: [{ title: "Safe", summary: "Text" }], projects: [{ title: "Bad", url: "javascript:alert(1)" }], stats: { totalTokens: -1, totalSpend: "a lot", agentTotals: {} } };
  const encoded = Buffer.from(JSON.stringify(bad)).toString("base64url");
  const room = readGuestRoom(`#room=${encoded}`);
  assert.ok(room);
  assert.equal(room.profile.theme, "studio");
  assert.deepEqual(room.agents, []);
  assert.deepEqual(room.projects, []);
  assert.equal(room.stats.totalTokens, null);
  assert.equal(room.stats.totalSpend, null);
});

test("invitations retain all 50 shared agents without silent truncation", () => {
  const agents = Array.from({ length: 50 }, (_, i) => ({ ...agent, id: `source-${i}`, name: `Session ${i}` }));
  const room = createGuestRoom({ ...input, agents, share: { ...DEFAULT_SHARE, agents: true } });
  const guest = readGuestRoom(new URL(invitationUrl(room, "https://dots.example/")).hash);
  assert.equal(guest.agents.length, 50);
  assert.equal(guest.agents.at(-1).name, "Session 49");
});

test('snapshot invitations preserve supplied identity and the original disconnection time', () => {
  const disconnectedAt = '2026-10-07T12:00:00Z';
  const room = createGuestRoom({ ...input, agents: [{ ...agent, ownerName: 'Room owner', status: 'offline', disconnectedAt }], share: { ...DEFAULT_SHARE, agents: true } });
  const guest = readGuestRoom(new URL(invitationUrl(room, 'https://dots.example/')).hash);
  assert.equal(guest.agents[0].ownerName, 'Room owner');
  assert.equal(guest.agents[0].disconnectedAt, disconnectedAt);
});
