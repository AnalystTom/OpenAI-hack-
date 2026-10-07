import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { LiveRoom } from '../server/live-room.mjs';

const origin = 'https://dots.test';
const agent = () => ({
  id: 'session-1', name: 'Imported session', harness: 'Codex', model: null,
  status: 'working', task: null, contextUsed: null, contextWindow: null,
  updatedAt: new Date().toISOString(),
});

function environment() {
  const rooms = new Map();
  return {
    ROOMS: {
      idFromName: name => name,
      get(id) {
        if (!rooms.has(id)) {
          const values = new Map();
          const ctx = {
            storage: {
              get: async key => values.get(key),
              put: async (key, value) => values.set(key, structuredClone(value)),
              setAlarm: async () => {}, deleteAll: async () => values.clear(),
            },
            getWebSockets: () => [],
            blockConcurrencyWhile: callback => { ctx.ready = callback(); },
          };
          const room = new LiveRoom(ctx);
          rooms.set(id, { fetch: async request => { await ctx.ready; return room.fetch(request); } });
        }
        return rooms.get(id);
      },
    },
    ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) },
  };
}

function request(env, path, method = 'GET', body, credential, headers = {}) {
  return worker.fetch(new Request(`${origin}/api/live/${path}`, {
    method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...headers },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  }), env);
}

async function participant(env) {
  const created = await request(env, 'rooms', 'POST');
  assert.equal(created.status, 201);
  const { roomId } = await created.json();
  const joined = await request(env, `rooms/${roomId}/join`, 'POST', { ownerName: 'Unit test uploader' });
  assert.equal(joined.status, 201);
  return { roomId, ...await joined.json() };
}

test('external callers cannot initialize or replace a chosen room', async () => {
  const env = environment();
  const { roomId } = await participant(env);
  for (const path of ['init', `rooms/${roomId}/init`])
    assert.equal((await request(env, path, 'POST')).status, 404);
  const missing = crypto.randomUUID();
  assert.equal((await request(env, `rooms/${missing}/join`, 'POST')).status, 410);
  assert.equal((await request(env, `rooms/${missing}/snapshot`)).status, 410);
});

test('upload credentials authorize only their own room and participant', async () => {
  const env = environment();
  const first = await participant(env), second = await participant(env);
  const body = { version: 1, agents: [agent()] };
  for (const credential of [undefined, 'wrong-token', first.uploadToken]) {
    assert.equal((await request(env, `rooms/${second.roomId}/feed`, 'PUT', body, credential)).status, 403);
    assert.equal((await request(env, `rooms/${second.roomId}/feed`, 'DELETE', undefined, credential)).status, 403);
  }
  assert.equal((await request(env, `rooms/${first.roomId}/feed`, 'PUT', body, first.uploadToken)).status, 200);
  const firstView = await (await request(env, `rooms/${first.roomId}/snapshot`)).json();
  const secondView = await (await request(env, `rooms/${second.roomId}/snapshot`)).json();
  assert.equal(firstView.agents.length, 1);
  assert.deepEqual(secondView.agents, []);
});

test('shared snapshots strip arbitrary fields and never expose participant credentials', async () => {
  const env = environment();
  const member = await participant(env);
  const a = agent(), b = { ...agent(), id: 'session-2' };
  const sentinel = 'private-upload-field';
  a.uploadToken = member.uploadToken;
  a.prompt = sentinel;
  a.health = { state: 'healthy', retrying: false, toolFailures: 0, retries: 0, recoveredRetries: 0, private: sentinel };
  a.cost = { estimatedUSD: null, observedRequests: 0, unpricedRequests: 0, assumedModelRequests: 0, private: sentinel };
  a.history = [{ at: a.updatedAt, status: 'working', label: 'Session active', private: sentinel }];
  const body = { version: 1, agents: [a, b], private: sentinel,
    interactions: [{ fromId: a.id, toId: b.id, at: a.updatedAt, kind: 'delegation', private: sentinel }] };
  assert.equal((await request(env, `rooms/${member.roomId}/feed`, 'PUT', body, member.uploadToken)).status, 200);
  const response = await request(env, `rooms/${member.roomId}/snapshot`);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const text = await response.text();
  assert.equal(text.includes(member.uploadToken), false);
  assert.equal(text.includes(sentinel), false);
  const view = JSON.parse(text);
  assert.equal(view.agents[0].id, `${member.memberId}:${a.id}`);
  assert.equal(view.interactions[0].fromId, view.agents[0].id);
  assert.equal(view.interactions[0].toId, view.agents[1].id);
});

test('invalid uploads and unsupported methods preserve the accepted snapshot', async () => {
  const env = environment();
  const { roomId, uploadToken } = await participant(env);
  const path = `rooms/${roomId}/feed`;
  const body = { version: 1, agents: [agent()] };
  assert.equal((await request(env, path, 'PUT', body, uploadToken)).status, 200);
  for (const invalid of ['{', { version: 2, agents: [] }, { version: 1, agents: [{}] },
    { version: 1, agents: [{ ...agent(), updatedAt: new Date(Date.now() + 120_000).toISOString() }] }])
    assert.equal((await request(env, path, 'PUT', invalid, uploadToken)).status, 400);
  assert.equal((await request(env, path, 'PUT', '{}', uploadToken, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request(env, path, 'PUT', undefined, uploadToken, { 'Content-Type': 'application/json' })).status, 400);
  for (const method of ['GET', 'PATCH'])
    assert.equal((await request(env, path, method, undefined, uploadToken)).status, 405);
  const view = await (await request(env, `rooms/${roomId}/snapshot`)).json();
  assert.equal(view.agents.length, 1);
  assert.equal(view.agents[0].name, body.agents[0].name);
});

test('live upload limit accepts exactly 64 KiB and rejects one byte more', async () => {
  const env = environment();
  const { roomId, uploadToken } = await participant(env);
  const json = JSON.stringify({ version: 1, agents: [] });
  const body = json.padEnd(64 * 1024, ' ');
  assert.equal((await request(env, `rooms/${roomId}/feed`, 'PUT', body, uploadToken)).status, 200);
  assert.equal((await request(env, `rooms/${roomId}/feed`, 'PUT', `${body} `, uploadToken)).status, 413);
});

test('disconnect removes only the departing participant and permanently revokes upload access', async () => {
  const env = environment();
  const first = await participant(env);
  const second = await (await request(env, `rooms/${first.roomId}/join`, 'POST', { ownerName: 'Second test uploader' })).json();
  const path = `rooms/${first.roomId}/feed`;
  const body = { version: 1, agents: [agent()] };
  for (const member of [first, second])
    assert.equal((await request(env, path, 'PUT', body, member.uploadToken)).status, 200);
  assert.equal((await request(env, path, 'DELETE', undefined, first.uploadToken)).status, 200);
  const view = await (await request(env, `rooms/${first.roomId}/snapshot`)).json();
  assert.equal(view.agents.length, 1);
  assert.equal(view.agents[0].id, `${second.memberId}:session-1`);
  assert.equal((await request(env, path, 'PUT', body, first.uploadToken)).status, 403);
  assert.equal((await request(env, path, 'DELETE', undefined, first.uploadToken)).status, 403);
  assert.equal((await request(env, path, 'PUT', body, second.uploadToken)).status, 200);
});

test('cross-origin browser requests cannot create, join, view, upload, or preflight a room', async () => {
  const env = environment();
  const { roomId, uploadToken } = await participant(env);
  for (const [path, method, body] of [
    ['rooms', 'POST'], [`rooms/${roomId}/join`, 'POST'], [`rooms/${roomId}/snapshot`, 'GET'],
    [`rooms/${roomId}/feed`, 'PUT', { version: 1, agents: [] }], [`rooms/${roomId}/feed`, 'OPTIONS'],
  ]) {
    const response = await request(env, path, method, body, uploadToken, { Origin: 'https://unrelated.test' });
    assert.equal(response.status, 403);
    assert.equal(response.headers.has('Access-Control-Allow-Origin'), false);
  }
  const preflight = await request(env, `rooms/${roomId}/feed`, 'OPTIONS', undefined, undefined, { Origin: origin });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
});
