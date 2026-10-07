import { chromium, expect as baseExpect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRobotsSessions } from '../server/codex-sessions.mjs';

// Runs real source readers and the actual bridge; never inserts product fixtures.
const origin = process.env.DOTS_TEST_URL ?? 'http://127.0.0.1:3000';
const api = process.env.DOTS_TEST_API_URL ?? origin;
const ownerName = process.env.DOTS_TEST_OWNER_NAME;
if (!ownerName) throw new Error('Supply the actual uploader name with DOTS_TEST_OWNER_NAME.');
const hosted = new URL(origin).protocol === 'https:';
const expectedAsset = process.env.DOTS_TEST_ASSET;
const source = await readRobotsSessions({ project: process.cwd() });
const active = source.agents.find(a => a.id === process.env.DOTS_TEST_ACTIVE_SESSION)
  ?? source.agents.find(a => a.status === 'working');
const idle = source.agents.find(a => a.status === 'idle' && a.name !== 'Session title unavailable');
const lifecycleId = process.env.DOTS_TEST_LIFECYCLE_SESSION;
const lifecycle = lifecycleId ? (await readRobotsSessions({ project: process.cwd(), threadIds: [lifecycleId] })).agents[0] : null;
if (!active || !idle || (lifecycleId && !lifecycle)) throw new Error('Choose existing working, completed, and optional lifecycle sessions.');
if (lifecycle && lifecycle.status !== 'idle') throw new Error('The lifecycle source must have actually completed before this test.');
const expect = baseExpect.configure({ timeout: 30_000 });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], bridges = new Set(), checks = [];
let downloadDirectory;
const report = (name, details = {}) => { checks.push({ name, ...details }); console.log(JSON.stringify(checks.at(-1))); };
async function newcomer(url) {
  const context = await browser.newContext(process.env.DOTS_TEST_MOBILE
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  if (expectedAsset) await expect(page.locator('script[src*="/assets/index-"]')).toHaveAttribute('src', expectedAsset);
  return page;
}
const credential = page => page.evaluate(() => JSON.parse(localStorage.getItem('dots-live-member-v1')));
async function openImport(page) {
  if (!await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Import agents', exact: true }).click();
}
async function enterRoom(page) {
  await page.getByRole('button', { name: 'Go to live room', exact: true }).click();
  await expect(page.getByText('Live room connected', { exact: true })).toBeVisible();
}
function bridge(member, ids, script = 'scripts/codex-bridge.mjs') {
  const child = spawn(process.execPath, [script, '--project', process.cwd(), '--sessions', ids.join(','),
    '--url', `${api}/api/live/rooms/${member.roomId}/feed`], {
    env: { ...process.env, DOTS_ROOM_UPLOAD_TOKEN: member.uploadToken }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  bridges.add(child);
  child.on('exit', () => bridges.delete(child));
  child.stderr.on('data', chunk => {
    const text = chunk.toString();
    if (!text.includes('ExperimentalWarning') && !text.includes('trace-warnings')) console.error(text.trim());
  });
  return child;
}
async function stop(child) {
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
}
const roster = (page, agent) => page.locator('.roster-item').filter({ has: page.getByText(agent.name, { exact: true }) });
async function showStatus(page, member, agent, status, timeout = 30_000) {
  await expect.poll(async () => (await snapshot(page, member.roomId)).agents.find(a => a.id === `${member.memberId}:${agent.id}`)?.status, { timeout }).toBe(status);
  await roster(page, agent).click();
  await expect(page.locator(`.agent-behavior.${status}`)).toBeVisible();
  await expect(page.locator('.detail-card dl div').filter({ has: page.getByText('Status', { exact: true }) }).locator('dd')).toHaveText(status === 'idle' ? 'chilling' : status);
}
async function snapshot(page, roomId) {
  const response = await page.request.get(`${api}/api/live/rooms/${roomId}/snapshot`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function showRealStatus(page, member, agent) {
  let actual;
  await expect.poll(async () => {
    actual = (await readRobotsSessions({ project: process.cwd(), threadIds: [agent.id] })).agents[0].status;
    return (await snapshot(page, member.roomId)).agents.find(a => a.id === `${member.memberId}:${agent.id}`)?.status === actual;
  }).toBe(true);
  await showStatus(page, member, agent, actual);
}
async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  }
}
try {
  const host = await newcomer(origin);
  await expect(host.locator('.roster-item')).toHaveCount(0);
  await expect(host.locator('.first-aid-panel, .agent-vitals')).toHaveCount(0);
  await fits(host);
  await openImport(host);
  await host.getByLabel('Your name', { exact: true }).fill(ownerName);
  await host.getByRole('button', { name: 'Create live room', exact: true }).click();
  await expect(host.getByRole('button', { name: 'Copy live prompt for Codex', exact: true })).toBeVisible();
  const hostMember = await credential(host);
  let downloadedBridge;
  if (hosted) {
    const response = await host.request.get(`${origin}/codex-bridge.mjs`);
    expect(response.ok()).toBe(true);
    const code = await response.text();
    expect(code).toContain('readRobotsSessions');
    expect(code.includes(hostMember.uploadToken)).toBe(false);
    expect(code.includes(hostMember.memberId)).toBe(false);
    downloadDirectory = await mkdtemp(join(tmpdir(), 'dots-hosted-bridge-'));
    downloadedBridge = join(downloadDirectory, 'codex-bridge.mjs');
    await writeFile(downloadedBridge, code);
    const listed = JSON.parse(execFileSync(process.execPath, [downloadedBridge, '--project', process.cwd(), '--list'], { encoding: 'utf8' }));
    expect(listed.find(a => a.id === active.id).name).toBe(active.name);
    expect(listed.find(a => a.id === idle.id).name).toBe(idle.name);
    await host.locator('summary', { hasText: 'Preview prompt' }).click();
    expect((await host.getByLabel('Codex import prompt').inputValue()).includes(api)).toBe(true);
    await fits(host);
    report('hosted bridge downloads and executes actual local metadata reader');
  }
  const hostIds = [active.id, ...(lifecycle ? [lifecycle.id] : [])];
  let hostBridge = bridge(hostMember, hostIds, downloadedBridge);
  await enterRoom(host);
  await expect(host.locator('.roster-item')).toHaveCount(hostIds.length);
  await showRealStatus(host, hostMember, active);
  const invitation = await host.getByLabel('Live room invitation', { exact: true }).inputValue();
  const visitor = await newcomer(invitation);
  await openImport(visitor);
  await visitor.getByLabel('Your name', { exact: true }).fill(ownerName);
  await visitor.getByRole('button', { name: 'Join this live room', exact: true }).click();
  await expect(visitor.getByRole('button', { name: 'Copy live prompt for Codex', exact: true })).toBeVisible();
  const visitorMember = await credential(visitor);
  expect(visitorMember.memberId).not.toBe(hostMember.memberId);
  bridge(visitorMember, [idle.id], downloadedBridge);
  await enterRoom(visitor);
  const count = hostIds.length + 1;
  await expect(host.locator('.roster-item')).toHaveCount(count);
  await expect(visitor.locator('.roster-item')).toHaveCount(count);
  await showRealStatus(visitor, hostMember, active);
  await expect(roster(visitor, idle)).toContainText('Chilling on the sofa');
  await expect(roster(visitor, idle).locator('b')).toHaveText(ownerName);
  const initialIds = (await snapshot(host, hostMember.roomId)).agents.map(a => a.id).sort();
  report('two distinct participants share real Codex sessions', { sourceIds: [...hostIds, idle.id] });
  await fits(host);
  await fits(visitor);
  await mkdir('test-results', { recursive: true });
  await visitor.getByRole('button', { name: 'Close details', exact: true }).click();
  await visitor.screenshot({ path: 'test-results/live-room-two-participants.png' });
  if (lifecycle) {
    await showStatus(host, hostMember, lifecycle, 'idle');
    report('READY for actual lifecycle follow-up', { sourceId: lifecycle.id });
    await showStatus(host, hostMember, lifecycle, 'working', 120_000);
    await showStatus(visitor, hostMember, lifecycle, 'working');
    report('actual source resumed work');
    await showStatus(host, hostMember, lifecycle, 'idle', 120_000);
    await showStatus(visitor, hostMember, lifecycle, 'idle');
    report('actual source completed and returned to the sofa');
  }
  await expect.poll(async () => (await snapshot(host, hostMember.roomId)).agents.map(a => a.id).sort()).toEqual(initialIds);
  await visitor.reload();
  await expect(visitor.locator('.roster-item')).toHaveCount(count);
  expect((await credential(visitor)).memberId).toBe(visitorMember.memberId);
  await openImport(visitor);
  await expect(visitor.getByRole('button', { name: 'Copy live prompt for Codex', exact: true })).toBeVisible();
  expect(await visitor.getByRole('button', { name: 'Join this live room', exact: true }).count()).toBe(0);
  await enterRoom(visitor);
  await expect.poll(async () => (await snapshot(visitor, hostMember.roomId)).agents.map(a => a.id).sort()).toEqual(initialIds);
  report('reload and repeat join preserve identity without duplicates');
  await stop(hostBridge);
  await showStatus(host, hostMember, active, 'offline');
  await showStatus(visitor, hostMember, active, 'offline');
  await expect(host.locator('.roster-item')).toHaveCount(count);
  await expect(visitor.locator('.roster-item')).toHaveCount(count);
  expect((await credential(host)).memberId).toBe(hostMember.memberId);
  expect((await credential(host)).uploadToken).toBe(hostMember.uploadToken);
  await expect(roster(visitor, idle)).toContainText('Chilling on the sofa');
  report('lost bridge heartbeat keeps disconnected agents on sofas for 30 minutes and preserves reconnection credentials');
  hostBridge = bridge(hostMember, hostIds, downloadedBridge);
  await showRealStatus(host, hostMember, active);
  await showRealStatus(visitor, hostMember, active);
  await expect.poll(async () => (await snapshot(host, hostMember.roomId)).agents.map(a => a.id).sort()).toEqual(initialIds);
  report('resumed bridge restores real status and stable identity');
  await stop(hostBridge);
  await host.getByRole('button', { name: 'Disconnect my agents', exact: true }).click();
  await expect(host.locator('.roster-item')).toHaveCount(1);
  await expect(visitor.locator('.roster-item')).toHaveCount(1);
  await expect(roster(visitor, idle)).toContainText('Chilling on the sofa');
  expect((await snapshot(visitor, hostMember.roomId)).agents[0].id).toBe(`${visitorMember.memberId}:${idle.id}`);
  const revoked = await host.request.put(`${api}/api/live/rooms/${hostMember.roomId}/feed`, {
    headers: { Authorization: `Bearer ${hostMember.uploadToken}` }, data: { version: 1, agents: [] },
  });
  expect(revoked.status()).toBe(403);
  report('disconnect removes only own agents');
  expect(errors).toEqual([]);
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/live-room-lifecycle.json', JSON.stringify({ origin, api, expectedAsset, checks, pageErrors: errors }, null, 2));
  await visitor.screenshot({ path: 'test-results/live-room-lifecycle.png' });
} catch (error) {
  await mkdir('test-results', { recursive: true });
  for (const [i, context] of browser.contexts().entries())
    await context.pages()[0]?.screenshot({ path: `test-results/live-room-failure-${i}.png` });
  throw error;
} finally {
  await Promise.all([...bridges].map(stop));
  await browser.close();
  if (downloadDirectory) await rm(downloadDirectory, { recursive: true, force: true });
}
