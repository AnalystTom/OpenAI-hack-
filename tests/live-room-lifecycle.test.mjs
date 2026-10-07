import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveRoom } from '../server/live-room.mjs';

async function roomAt(t) {
  let now = Date.parse('2026-10-06T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const values = new Map(), alarms = [], messages = [], closes = [];
  const ctx = {
    storage: {
      get: async key => values.get(key),
      put: async (key, value) => values.set(key, structuredClone(value)),
      setAlarm: async at => alarms.push(at),
      deleteAll: async () => values.clear(),
    },
    getWebSockets: () => [{ send: text => messages.push(JSON.parse(text)), close: (...args) => closes.push(args) }],
    blockConcurrencyWhile: callback => { ctx.ready = callback(); },
  };
  const room = new LiveRoom(ctx);
  await ctx.ready;
  const request = (action, method = 'POST', credential, body) => room.fetch(new Request(`https://dots.test/${action}`, {
    method, headers: { ...(credential ? { Authorization: `Bearer ${credential.uploadToken}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  assert.equal((await request('init')).status, 201);
  const join = async () => (await request('join', 'POST', undefined, { ownerName: 'Unit test uploader' })).json();
  const upload = async (member, agents, interactions = [], mode = '') => {
    assert.equal((await request(`feed${mode}`, 'PUT', member, { version: 1, agents, interactions })).status, 200);
  };
  // Fixtures are confined to this in-memory relay test, never loaded in product UI.
  const agent = (id, status = 'working') => ({ id, name: `Test ${id}`, harness: 'Codex', model: null,
    task: null, contextUsed: null, contextWindow: null, status, updatedAt: new Date(now).toISOString(), activityLabel: status === 'working' ? 'Running tests' : null });
  return { room, ctx, values, alarms, messages, closes, join, upload, agent, request,
    advance: ms => { now += ms; }, now: () => now };
}

test('lost heartbeats retain disconnected agents for 30 minutes, then hide them and restore stable identity on return', async t => {
  const s = await roomAt(t), member = await s.join();
  const a = s.agent('a'), b = s.agent('b');
  const link = { fromId: 'a', toId: 'b', at: a.updatedAt, kind: 'delegation' };
  await s.upload(member, [a, b], [link]);
  const ids = s.room.snapshot().agents.map(a => a.id);
  assert.equal(s.alarms.at(-1), s.now() + 20_000);
  s.advance(19_999);
  assert.equal(s.room.snapshot().agents[0].status, 'working');
  s.advance(1);
  await s.room.alarm();
  assert.deepEqual(s.messages.at(-1).agents.map(a => [a.id, a.status]), ids.map(id => [id, 'offline']));
  assert.equal(s.messages.at(-1).agents[0].disconnectedAt, new Date(s.now()).toISOString());
  assert.equal(s.messages.at(-1).agents[0].activityLabel, null);
  assert.deepEqual(s.messages.at(-1).interactions, []);
  assert.equal(s.room.room.members[0].id, member.memberId);
  assert.equal(s.room.room.members[0].snapshot.agents.length, 2);
  assert.equal(s.alarms.at(-1), s.now() + 30 * 60_000);
  s.advance(30 * 60_000 - 1);
  assert.equal(s.room.snapshot().agents.length, 2);
  s.advance(1);
  await s.room.alarm();
  assert.deepEqual(s.messages.at(-1).agents, []);
  assert.equal(s.alarms.at(-1), s.room.room.expiresAt);
  await s.upload(member, [s.agent('a'), s.agent('b')], [link]);
  assert.deepEqual(s.messages.at(-1).agents.map(a => a.id), ids);
  assert.equal(s.messages.at(-1).agents[0].status, 'working');
  assert.equal(s.messages.at(-1).agents[0].disconnectedAt, undefined);
  assert.equal(s.messages.at(-1).interactions.length, 1);
});

test('participants renew independently and session ID collisions cannot merge their agents', async t => {
  const s = await roomAt(t), first = await s.join(), second = await s.join();
  await s.upload(first, [s.agent('same-session')]);
  s.advance(10_000);
  await s.upload(second, [s.agent('same-session', 'idle')]);
  s.advance(10_000);
  await s.room.alarm();
  assert.deepEqual(s.room.snapshot().agents.map(a => [a.id, a.status]), [
    [`${first.memberId}:same-session`, 'offline'],
    [`${second.memberId}:same-session`, 'idle'],
  ]);
  assert.equal(s.alarms.at(-1), s.now() + 10_000);
  await s.upload(first, [s.agent('same-session')]);
  s.advance(10_000);
  await s.room.alarm();
  assert.deepEqual(s.room.snapshot().agents.map(a => [a.id, a.status]), [
    [`${first.memberId}:same-session`, 'working'], [`${second.memberId}:same-session`, 'offline'],
  ]);
});

test('saved snapshots never pretend a recorded working status is live and survive a restart', async t => {
  const s = await roomAt(t), member = await s.join();
  await s.upload(member, [s.agent('recorded-work'), s.agent('completed', 'idle')], [], '?mode=snapshot');
  s.advance(60_000);
  await s.room.alarm();
  const restored = new LiveRoom(s.ctx);
  await s.ctx.ready;
  assert.deepEqual(restored.snapshot().agents.map(a => [a.status, a.activityLabel]), [['unknown', null], ['idle', null]]);
  assert.deepEqual(restored.snapshot().agents.map(a => a.id), s.room.snapshot().agents.map(a => a.id));
});

test('room expiry closes viewers, clears persistent participants, and refuses stale credentials', async t => {
  const s = await roomAt(t), member = await s.join();
  await s.upload(member, [s.agent('a')]);
  s.advance(24 * 60 * 60_000);
  await s.room.alarm();
  assert.deepEqual(s.closes, [[1000, 'Room expired']]);
  assert.equal(s.values.size, 0);
  assert.equal(s.room.room, null);
  for (const [action, method] of [['snapshot', 'GET'], ['join', 'POST'], ['feed', 'PUT']])
    assert.equal((await s.request(action, method, member)).status, 410);
});

test('lightweight heartbeats renew unchanged rosters and restore expired agents with the same IDs', async t => {
  const s = await roomAt(t), member = await s.join();
  assert.equal((await s.request('feed', 'POST', member)).status, 409);
  await s.upload(member, [s.agent('a')]);
  const id = s.room.snapshot().agents[0].id;
  const count = s.messages.length;
  s.advance(12_000);
  assert.equal((await s.request('feed', 'POST', member)).status, 200);
  assert.equal(s.messages.length, count);
  s.advance(12_000);
  assert.equal(s.room.snapshot().agents[0].status, 'working');
  s.advance(8_000);
  await s.room.alarm();
  assert.equal(s.messages.at(-1).agents[0].status, 'offline');
  assert.equal((await s.request('feed', 'POST', member)).status, 200);
  assert.equal(s.messages.at(-1).agents[0].status, 'working');
  assert.equal(s.messages.at(-1).agents[0].id, id);
});

test('source-offline agents wait for 30 minutes without retaining live interaction links', async t => {
  const s = await roomAt(t), member = await s.join();
  const agents = [s.agent('a'), s.agent('b', 'offline'), s.agent('c', 'idle')];
  const link = (fromId, toId) => ({ fromId, toId, at: agents[0].updatedAt, kind: 'delegation' });
  await s.upload(member, agents, [link('a', 'b'), link('b', 'c'), link('a', 'c')]);
  assert.deepEqual(s.room.snapshot().agents.map(a => a.id), [`${member.memberId}:a`, `${member.memberId}:b`, `${member.memberId}:c`]);
  const disconnectedAt = s.room.snapshot().agents[1].disconnectedAt;
  assert.equal(disconnectedAt, new Date(s.now()).toISOString());
  assert.deepEqual(s.room.snapshot().interactions.map(link => [link.fromId, link.toId]), [[`${member.memberId}:a`, `${member.memberId}:c`]]);
  await s.upload(member, [s.agent('a'), s.agent('b', 'idle'), s.agent('c', 'idle')]);
  assert.equal(s.room.snapshot().agents[1].id, `${member.memberId}:b`);
  assert.equal(s.room.snapshot().agents[1].disconnectedAt, undefined);
  await s.upload(member, agents, [], '?mode=snapshot');
  assert.deepEqual(s.room.snapshot().agents.map(a => [a.id, a.status]), [[`${member.memberId}:a`, 'unknown'], [`${member.memberId}:b`, 'offline'], [`${member.memberId}:c`, 'idle']]);
  s.advance(30 * 60_000);
  await s.room.alarm();
  assert.deepEqual(s.room.snapshot().agents.map(a => [a.id, a.status]), [[`${member.memberId}:a`, 'unknown'], [`${member.memberId}:c`, 'idle']]);
});

test('expired participants free seats and resume safely only when real seats are available', async t => {
  const s = await roomAt(t), first = await s.join(), second = await s.join();
  const seats = Array.from({ length: 50 }, (_, i) => s.agent(`seat-${i}`));
  await s.upload(first, seats);
  const firstIds = s.room.snapshot().agents.map(a => a.id);
  const receivedAt = s.room.room.members[0].receivedAt;
  s.advance(20_000);
  await s.room.alarm();
  assert.equal(s.room.snapshot().agents.length, 50);
  s.advance(30 * 60_000);
  await s.room.alarm();
  assert.deepEqual(s.room.snapshot().agents, []);
  await s.upload(second, seats);
  const full = s.room.snapshot(), broadcasts = s.messages.length;
  assert.equal((await s.request('feed', 'POST', first)).status, 409);
  assert.equal(s.room.room.members[0].receivedAt, receivedAt);
  assert.deepEqual(s.room.snapshot(), full);
  assert.equal(s.messages.length, broadcasts);
  await s.upload(second, []);
  assert.equal((await s.request('feed', 'POST', first)).status, 200);
  assert.deepEqual(s.room.snapshot().agents.map(a => a.id), firstIds);
  await s.upload(first, [s.agent('seat-0'), s.agent('offline-seat', 'offline')]);
  await s.upload(second, seats.slice(0, 48));
  assert.equal(s.room.snapshot().agents.length, 50);
  assert.equal((await s.request('feed', 'POST', first)).status, 200);
  assert.equal(s.room.snapshot().agents.some(a => a.id.endsWith(':offline-seat')), true);
});

test('offline retention survives relay restart and renewed feeds cannot extend a source disconnection', async t => {
  const s = await roomAt(t), member = await s.join();
  await s.upload(member, [s.agent('a', 'offline')]);
  const disconnectedAt = s.room.snapshot().agents[0].disconnectedAt;
  s.advance(29 * 60_000);
  await s.upload(member, [s.agent('a', 'offline')]);
  const restored = new LiveRoom(s.ctx);
  await s.ctx.ready;
  assert.equal(restored.snapshot().agents[0].disconnectedAt, disconnectedAt);
  s.advance(60_000);
  await restored.alarm();
  assert.deepEqual(restored.snapshot().agents, []);
  await s.upload(member, [s.agent('a')]);
  assert.equal(s.room.snapshot().agents[0].status, 'working');
});

test('an already old source disconnection stays hidden on its first live upload', async t => {
  const s = await roomAt(t), member = await s.join();
  await s.upload(member, [{ ...s.agent('old-source', 'offline'), updatedAt: new Date(s.now() - 30 * 60_000).toISOString() }]);
  assert.deepEqual(s.room.snapshot().agents, []);
  assert.equal((await s.request('feed', 'POST', member)).status, 200);
  assert.deepEqual(s.room.snapshot().agents, []);
});

test('uploader identity belongs to the credential and survives renaming and restart', async t => {
  const s = await roomAt(t), member = await s.join();
  await s.upload(member, [{ ...s.agent('a'), ownerName: 'Forged name' }]);
  assert.equal(s.room.snapshot().agents[0].ownerName, 'Unit test uploader');
  const updated = await (await s.request('join', 'POST', member, { ownerName: 'Renamed test uploader' })).json();
  assert.equal(updated.memberId, member.memberId);
  assert.equal(s.room.room.members.length, 1);
  const restored = new LiveRoom(s.ctx);
  await s.ctx.ready;
  assert.equal(restored.snapshot().agents[0].ownerName, 'Renamed test uploader');
  assert.equal((await s.request('join', 'POST', undefined, { ownerName: '' })).status, 400);
});
