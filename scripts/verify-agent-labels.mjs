import { chromium, expect as baseExpect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { readRobotsSessions } from '../server/codex-sessions.mjs';

// Only actual local sessions and actual relay-observed disconnect times enter the UI.
const origin = process.env.DOTS_TEST_URL ?? 'http://127.0.0.1:3000';
const ownerName = process.env.DOTS_TEST_OWNER_NAME;
if (!ownerName) throw new Error('Supply your actual display name with DOTS_TEST_OWNER_NAME.');
const source = await readRobotsSessions({ project: process.cwd() });
const idle = source.agents.filter(a => a.status === 'idle').slice(0, 4);
const active = source.agents.find(a => a.id === process.env.DOTS_TEST_ACTIVE_SESSION) ?? source.agents.find(a => a.status === 'working');
if (idle.length !== 4 || !active) throw new Error('Four actual completed sessions and one active session are required.');
const expect = baseExpect.configure({ timeout: 30_000 });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], children = new Set(), checks = [];
const prefix = new URL(origin).protocol === 'https:' ? 'remote' : 'local';
let member, feedUrl;
await mkdir('test-results', { recursive: true });
const report = (name, data = {}) => { checks.push({ name, ...data }); console.log(JSON.stringify(checks.at(-1))); };
async function pageWith(snapshot, time) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (snapshot) await context.addInitScript(data => localStorage.setItem('dots-office-v1', JSON.stringify(data)), snapshot);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  if (time) await page.clock.install({ time });
  await page.goto(origin);
  return page;
}
async function plates(page) {
  return page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
    const { scene } = _roots.get(document.querySelector('canvas')).store.getState();
    const found = [];
    scene.traverse(object => {
      if (object.userData.agentNameplate && object.parent.name.startsWith('office-agent:')) found.push({
        name: object.userData.name, width: object.userData.width, height: object.userData.height,
        position: object.position.toArray(), center: object.center.toArray(), visible: object.visible,
        leaders: object.parent.children.filter(child => child.isLine).length,
      });
    });
    return found;
  });
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
}
function bridge() {
  const child = spawn(process.execPath, ['public/codex-bridge.mjs', '--project', process.cwd(), '--sessions', active.id, '--url', feedUrl], {
    env: { ...process.env, DOTS_ROOM_UPLOAD_TOKEN: member.uploadToken }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child); child.on('exit', () => children.delete(child));
  return child;
}
async function snapshot(page) {
  const response = await page.request.get(feedUrl.replace(/\/feed$/, '/snapshot'));
  expect(response.ok()).toBe(true);
  return response.json();
}
try {
  const legacy = await pageWith({ version: 1, agents: idle });
  await expect(legacy.locator('.roster-item')).toHaveCount(4);
  expect(await legacy.locator('.roster-item b').allTextContents()).toEqual(idle.map(a => a.name));
  await expect(legacy.getByText('Uploader not provided', { exact: true })).toHaveCount(0);
  await legacy.locator('.roster-item').first().click();
  await expect(legacy.locator('.detail-card h2')).toHaveText(idle[0].name);
  if (prefix === 'local') {
    await expect.poll(async () => (await plates(legacy)).length).toBe(4);
    const before = await plates(legacy);
    for (const plate of before) {
      expect(plate.position).toEqual([0, 2.05, 0]); expect(plate.center).toEqual([0.5, 0]);
      expect(plate.width).toBeLessThanOrEqual(88); expect(plate.height).toBe(22);
      expect(plate.visible).toBe(true); expect(plate.leaders).toBe(0);
    }
    await legacy.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await legacy.getByRole('button', { name: 'Zoom in', exact: true }).click();
    expect((await plates(legacy)).map(p => ({ position: p.position, center: p.center, width: p.width, height: p.height })))
      .toEqual(before.map(p => ({ position: p.position, center: p.center, width: p.width, height: p.height })));
    await legacy.getByRole('button', { name: 'Room overview', exact: true }).click();
  }
  await legacy.getByRole('button', { name: 'Close details', exact: true }).click();
  await legacy.screenshot({ path: `test-results/nameplates-${prefix}-legacy.png` });
  report('Legacy nameless data uses actual session titles; labels are compact and anchored', { sessions: 4, sceneAssertions: prefix === 'local' });

  await legacy.getByRole('button', { name: 'Import agents', exact: true }).click();
  await legacy.getByLabel('Your name', { exact: true }).fill(ownerName);
  await legacy.getByLabel('Snapshot file', { exact: true }).setInputFiles({ name: 'actual-sessions.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, agents: idle })) });
  await legacy.getByRole('button', { name: 'Add to this world' }).click();
  expect(await legacy.locator('.roster-item b').allTextContents()).toEqual(idle.map(() => ownerName));
  await legacy.locator('.roster-item').first().click();
  await expect(legacy.locator('.detail-card h2')).toHaveText(ownerName);
  await legacy.getByRole('button', { name: 'Close details', exact: true }).click();
  await legacy.screenshot({ path: `test-results/nameplates-${prefix}-named.png` });
  await legacy.setViewportSize({ width: 390, height: 844 });
  expect(await legacy.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await legacy.screenshot({ path: `test-results/nameplates-${prefix}-mobile.png` });
  report('Supplied name appears on all selected actual sessions and mobile has no horizontal overflow');

  const live = await pageWith();
  await live.getByRole('button', { name: 'Import agents', exact: true }).click();
  await live.getByLabel('Your name', { exact: true }).fill(ownerName);
  await live.getByRole('button', { name: 'Create live room', exact: true }).click();
  await live.locator('summary', { hasText: 'Preview prompt' }).click();
  feedUrl = (await live.getByLabel('Codex import prompt').inputValue()).match(/https?:\/\/[^\s]+\/api\/live\/rooms\/[a-f0-9-]+\/feed/)[0];
  member = await live.evaluate(() => JSON.parse(localStorage.getItem('dots-live-member-v1')));
  let child = bridge();
  await live.getByRole('button', { name: 'Go to live room', exact: true }).click();
  await expect(live.locator('.roster-item')).toHaveCount(1);
  const identity = (await snapshot(live)).agents[0].id;
  await stop(child);
  await expect.poll(async () => (await snapshot(live)).agents[0]?.status).toBe('offline');
  await live.locator('.roster-item').click();
  await expect(live.locator('.agent-behavior.offline')).toBeVisible();
  await expect(live.locator('.detail-card')).toContainText('hidden after 30 minutes');
  const actualOffline = (await snapshot(live)).agents[0];
  expect(actualOffline.disconnectedAt).toBeTruthy();
  expect(actualOffline.activityLabel).toBeNull();
  await live.screenshot({ path: `test-results/nameplates-${prefix}-disconnected.png` });
  report('Actual stopped bridge stays visible as disconnected on the couch', { disconnectedAt: actualOffline.disconnectedAt });

  const expiring = await pageWith({ version: 1, agents: [actualOffline] }, Date.parse(actualOffline.disconnectedAt) + 30 * 60_000 - 1000);
  await expect(expiring.locator('.roster-item')).toHaveCount(1);
  await expiring.clock.fastForward(1000);
  await expect(expiring.locator('.roster-item')).toHaveCount(0);
  await expiring.reload();
  await expect(expiring.locator('.roster-item')).toHaveCount(0);
  report('Actual recorded disconnect is hidden at 30 minutes and stays hidden after reload', { controlledBrowserClock: true });

  child = bridge();
  await expect.poll(async () => (await snapshot(live)).agents[0]?.status).toBe('working');
  expect((await snapshot(live)).agents[0].id).toBe(identity);
  expect((await snapshot(live)).agents[0].disconnectedAt).toBeUndefined();
  await stop(child);
  await live.getByRole('button', { name: 'Disconnect my agents', exact: true }).click();
  await expect(live.locator('.roster-item')).toHaveCount(0);
  report('Reconnect preserves identity, and explicit stop sharing removes the agent immediately');
  expect(errors).toEqual([]);
  await writeFile(`test-results/nameplates-${prefix}.json`, JSON.stringify({ origin, checks, pageErrors: errors }, null, 2));
} finally {
  await Promise.all([...children].map(stop));
  if (member && feedUrl) await fetch(feedUrl, { method: 'DELETE', headers: { Authorization: `Bearer ${member.uploadToken}` } });
  await browser.close();
}
