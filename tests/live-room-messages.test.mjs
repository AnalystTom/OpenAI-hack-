import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRoomMessage } from '../src/liveRoom.ts';
import { agentActivityLabel, agentDisplayName, agentIsVisible, officeSummary } from '../src/officeActivity.ts';
import { parseOfficeSnapshot } from '../src/snapshot.ts';
import { serializeOffice, readSavedOffice } from '../src/officeStore.ts';

const a = '11111111-1111-1111-1111-111111111111', b = '22222222-2222-2222-2222-222222222222';
const agent = (member, id, status = 'working') => ({ id: `${member}:${id}`, name: 'Unit test session', ownerName: 'Test uploader', harness: 'Codex', model: null, task: null, status, contextUsed: null, contextWindow: null, updatedAt: new Date().toISOString() });
test('participant updates replace only their own roster, preserve order, and remove departed agents', () => {
  const current = { version: 1, agents: [agent(a, '1'), agent(a, '2'), agent(b, '1')] };
  const next = applyRoomMessage(current, JSON.stringify({ type: 'member', memberId: a, agents: [agent(a, '1', 'idle')] }));
  assert.deepEqual(next.agents.map(agent => [agent.id, agent.status]), [[`${a}:1`, 'idle'], [`${b}:1`, 'working']]);
  assert.deepEqual(applyRoomMessage(next, JSON.stringify({ type: 'member', memberId: a, agents: [] })).agents, [current.agents[2]]);
  assert.throws(() => applyRoomMessage(current, JSON.stringify({ type: 'member', memberId: a, agents: [agent(b, '2')] })), /identity/);
});

test('missing uploader identity uses the real session title, and only disconnected agents expire', () => {
  const source = agent(a, '1');
  assert.equal(agentDisplayName(source), 'Test uploader');
  assert.equal(agentDisplayName({ ...source, ownerName: undefined }), source.name);
  const disconnectedAt = '2026-10-07T12:00:00Z';
  const offline = { ...source, status: 'offline', disconnectedAt, updatedAt: '2026-10-06T12:00:00Z' };
  assert.equal(agentIsVisible(offline, Date.parse(disconnectedAt) + 30 * 60_000 - 1), true);
  assert.equal(agentIsVisible(offline, Date.parse(disconnectedAt) + 30 * 60_000), false);
  assert.equal(agentIsVisible({ ...offline, status: 'idle' }, Date.parse(disconnectedAt) + 60 * 60_000), true);
  assert.equal(agentIsVisible({ ...offline, disconnectedAt: undefined }, Date.parse(disconnectedAt)), false);
  assert.equal(readSavedOffice({ getItem: () => serializeOffice([offline]) }).agents[0].disconnectedAt, disconnectedAt);
  assert.throws(() => parseOfficeSnapshot(serializeOffice([{ ...offline, disconnectedAt: 'invalid' }])), /timestamp/);
});
test('activity and summary never turn a disconnected source or a task title into live progress', () => {
  const working = { ...agent(a, '1'), name: 'Testing a deployment', activityLabel: null };
  assert.equal(agentActivityLabel(working), undefined);
  assert.equal(agentActivityLabel({ ...working, activityLabel: 'Running tests' }), 'Running tests');
  assert.equal(agentActivityLabel({ ...working, status: 'offline', activityLabel: 'Running tests' }), undefined);
  assert.equal(officeSummary([working, agent(b, '1', 'idle'), agent(b, '2', 'offline')]), '1 working · 1 chilling · 1 disconnected');
});
