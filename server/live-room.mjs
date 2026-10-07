import { parseOfficeSnapshot } from '../src/snapshot.ts';
import { serializeOffice } from '../src/officeStore.ts';
import { liveMetadata } from '../src/liveRoom.ts';
import { agentIsVisible, DISCONNECTED_RETENTION_MS } from '../src/officeActivity.ts';

const FEED_LEASE_MS = 20_000;
const ROOM_LIFETIME_MS = 24 * 60 * 60_000;
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, '0')).join('');
const LIVE_BODY_LIMIT = 64 * 1024;
async function readBody(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Send a JSON request body.');
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(data);
}

/** One isolated, expiring room. Member credentials never reach other viewers. */
export class LiveRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.room = null;
    ctx.blockConcurrencyWhile(async () => { this.room = await ctx.storage.get('room') ?? null; });
  }

  snapshot(now = Date.now()) {
    const agents = [], interactions = [];
    for (const member of this.room.members) {
      const fresh = member.live && now - member.receivedAt < FEED_LEASE_MS;
      const presentIds = new Set();
      for (const agent of member.snapshot.agents) {
        let disconnectedAt = agent.status === 'offline' ? agent.disconnectedAt ?? agent.updatedAt : undefined;
        if (member.live && !fresh) disconnectedAt = new Date(Math.min(
          member.receivedAt + FEED_LEASE_MS, disconnectedAt ? Date.parse(disconnectedAt) : Infinity,
        )).toISOString();
        const visible = {
          ...agent, id: `${member.id}:${agent.id}`, ownerName: member.ownerName?.trim() || undefined,
          status: disconnectedAt ? 'offline' : agent.status === 'working' && (!member.live || now - Date.parse(agent.updatedAt) > 5 * 60_000) ? 'unknown' : agent.status,
          disconnectedAt, activityLabel: fresh && !disconnectedAt ? agent.activityLabel : null,
        };
        if (!agentIsVisible(visible, now)) continue;
        agents.push(visible);
        if (!disconnectedAt) presentIds.add(agent.id);
      }
      if (fresh) for (const link of member.snapshot.interactions ?? []) {
        if (!presentIds.has(link.fromId) || !presentIds.has(link.toId)) continue;
        interactions.push({
          ...link, fromId: `${member.id}:${link.fromId}`, toId: `${member.id}:${link.toId}`,
        });
      }
    }
    return { version: 1, agents, interactions, expiresAt: this.room.expiresAt };
  }

  broadcast(memberId) {
    const view = this.snapshot();
    const message = JSON.stringify(memberId ? {
      type: 'member', memberId,
      agents: view.agents.filter(a => a.id.startsWith(`${memberId}:`)),
      interactions: view.interactions.filter(link => link.fromId.startsWith(`${memberId}:`)),
    } : view);
    if (message === this.lastBroadcast) return;
    this.lastBroadcast = message;
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(message); } catch { socket.close(1011, 'Connection lost'); }
    }
  }

  async save(broadcast = true, memberId) {
    await this.ctx.storage.put('room', this.room);
    const leases = this.room.members.filter(m => m.live && Date.now() - m.receivedAt < FEED_LEASE_MS).map(m => m.receivedAt + FEED_LEASE_MS);
    const staleWork = this.room.members.filter(m => m.live && Date.now() - m.receivedAt < FEED_LEASE_MS).flatMap(m => m.snapshot.agents
      .filter(a => a.status === 'working').map(a => Date.parse(a.updatedAt) + 5 * 60_000 + 1).filter(at => at > Date.now()));
    const departures = this.snapshot().agents.filter(a => a.status === 'offline')
      .map(a => Date.parse(a.disconnectedAt) + DISCONNECTED_RETENTION_MS);
    await this.ctx.storage.setAlarm(Math.min(this.room.expiresAt, ...leases, ...staleWork, ...departures));
    if (broadcast) this.broadcast(memberId);
  }

  async fetch(request) {
    const action = new URL(request.url).pathname.split('/').at(-1);
    if (action === 'init' && request.method === 'POST' && !this.room) {
      this.room = { expiresAt: Date.now() + ROOM_LIFETIME_MS, members: [] };
      await this.save();
      return json({ expiresAt: this.room.expiresAt }, 201);
    }
    if (!this.room || this.room.expiresAt <= Date.now()) return json({ error: 'This live room expired. Create a new room.' }, 410);
    if (action === 'join' && request.method === 'POST') {
      let ownerName;
      try {
        const text = await readBody(request, 1024);
        if (text === null) return json({ error: 'Participant details are too large.' }, 413);
        ownerName = JSON.parse(text).ownerName?.trim();
        if (!ownerName || ownerName.length > 60) throw new Error('Enter your name using 1 to 60 characters.');
      } catch { return json({ error: 'Enter your name using 1 to 60 characters.' }, 400); }
      const existing = this.room.members.find(m => request.headers.get('Authorization') === `Bearer ${m.uploadToken}`);
      if (existing) {
        existing.ownerName = ownerName;
        await this.save();
        return json({ memberId: existing.id, uploadToken: existing.uploadToken, ownerName, expiresAt: this.room.expiresAt });
      }
      if (this.room.members.length >= 50) return json({ error: 'This room has reached its participant limit.' }, 409);
      const member = { id: crypto.randomUUID(), ownerName, uploadToken: token(), snapshot: { version: 1, agents: [] }, receivedAt: 0, live: false };
      this.room.members.push(member);
      await this.save();
      return json({ memberId: member.id, uploadToken: member.uploadToken, ownerName, expiresAt: this.room.expiresAt }, 201);
    }
    if (action === 'stream' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      if (this.ctx.getWebSockets().length >= 100) return json({ error: 'This room has too many viewers.' }, 429);
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify(this.snapshot()));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (action === 'snapshot' && request.method === 'GET') return json(this.snapshot());
    const member = this.room.members.find(m => request.headers.get('Authorization') === `Bearer ${m.uploadToken}`);
    if (!member) return json({ error: 'Invalid participant credential.' }, 403);
    if (action === 'feed' && request.method === 'POST') {
      if (!member.live) return json({ error: 'Send a live session update before renewing the connection.' }, 409);
      const others = this.snapshot().agents.filter(a => !a.id.startsWith(`${member.id}:`)).length;
      if (others + member.snapshot.agents.filter(a => agentIsVisible(a)).length > 50) return json({ error: 'This room supports 50 agents. Select fewer sessions.' }, 409);
      const previous = JSON.stringify(this.snapshot());
      member.receivedAt = Date.now();
      await this.save(previous !== JSON.stringify(this.snapshot()), member.id);
      return json({ accepted: member.snapshot.agents.length, heartbeat: true });
    }
    if (action === 'feed' && request.method === 'DELETE') {
      // Revoke the bridge credential when a participant disconnects.
      this.room.members = this.room.members.filter(m => m !== member);
      await this.save(true, member.id);
      return json({ disconnected: true });
    }
    if (action !== 'feed' || request.method !== 'PUT') return json({ error: 'Unsupported room action.' }, 405);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Send session metadata as application/json.' }, 415);
    try {
      const text = await readBody(request, LIVE_BODY_LIMIT);
      if (text === null) return json({ error: 'Live metadata must be smaller than 64 KiB. Select fewer sessions.' }, 413);
      const parsed = parseOfficeSnapshot(text);
      for (const agent of parsed.agents) {
        if (agent.id.length > 200 || agent.name.length > 300 || agent.harness.length > 100 || (agent.model?.length ?? 0) > 120 || (agent.task?.length ?? 0) > 300) throw new Error('Session metadata is too long. Export only short session titles.');
        if (Date.parse(agent.updatedAt) > Date.now() + 60_000) throw new Error('Session timestamps cannot be in the future.');
      }
      const metadata = liveMetadata(parsed);
      const isLive = new URL(request.url).searchParams.get('mode') !== 'snapshot';
      for (const agent of metadata.agents) if (agent.status === 'offline') {
        const previous = member.snapshot.agents.find(a => a.id === agent.id && a.status === 'offline');
        agent.disconnectedAt = previous?.disconnectedAt ?? agent.updatedAt;
      }
      const others = this.snapshot().agents.filter(a => !a.id.startsWith(`${member.id}:`)).length;
      if (others + metadata.agents.filter(a => agentIsVisible(a)).length > 50) return json({ error: 'This room supports 50 agents. Select fewer sessions.' }, 409);
      const snapshot = JSON.parse(serializeOffice(metadata.agents, metadata.interactions));
      const nextRoom = { ...this.room, members: this.room.members.map(m => m === member ? { ...m, snapshot } : m) };
      if (new TextEncoder().encode(JSON.stringify(nextRoom)).length > 96 * 1024) return json({ error: 'This room is full. Select fewer sessions.' }, 409);
      member.snapshot = snapshot;
      member.live = isLive;
      member.receivedAt = Date.now();
      await this.save(true, member.id);
      return json({ accepted: parsed.agents.length });
    } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to read sessions.' }, 400); }
  }

  async alarm() {
    if (!this.room) return;
    if (Date.now() >= this.room.expiresAt) {
      for (const socket of this.ctx.getWebSockets()) socket.close(1000, 'Room expired');
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.save();
  }

  webSocketMessage() { /* Room streams are read-only. */ }
  webSocketClose(socket) { socket.close(); }
  webSocketError(socket) { socket.close(1011, 'Connection lost'); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/live/')) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    const allowed = [url.origin, env.ALLOWED_ORIGIN].filter(Boolean);
    if (origin && !allowed.includes(origin)) return json({ error: 'Open Dots to use this room.' }, 403);
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
    let response;
    if (url.pathname === '/api/live/rooms' && request.method === 'POST') {
      const roomId = crypto.randomUUID();
      const room = env.ROOMS.get(env.ROOMS.idFromName(roomId));
      response = await room.fetch(new Request(`${url.origin}/init`, { method: 'POST' }));
      if (response.ok) response = json({ roomId, ...await response.json() }, 201);
    } else {
      const match = url.pathname.match(/^\/api\/live\/rooms\/([a-f0-9-]{36})\/(join|feed|snapshot|stream)$/);
      if (!match) return json({ error: 'Room endpoint not found.' }, 404);
      response = await env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
    }
    if (response.status === 101) return response;
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  },
};
