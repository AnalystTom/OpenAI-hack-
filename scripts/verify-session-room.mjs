import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Use an explicitly supplied real metadata export; never seed product UI with fixtures.
const source = JSON.parse(await readFile(process.env.DOTS_TEST_SNAPSHOT, 'utf8'));
if (source.agents.length < 7) throw new Error('Supply at least seven real sessions to exercise joining.');
const origin = process.env.DOTS_TEST_URL ?? 'http://127.0.0.1:3002';
expect.configure({ timeout: 30000 });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
async function newcomer(url = origin) {
  const context = await browser.newContext({ viewport: { width: 1510, height: 925 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  const pause = page.getByRole('button', { name: 'Pause office', exact: true });
  if (await pause.count() && !await page.getByRole('dialog').count()) await pause.click();
  return page;
}
async function importAgents(page, agents) {
  if (!await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Import agents', exact: true }).click();
  const ids = new Set(agents.map((agent) => agent.id));
  await page.getByLabel('Snapshot file', { exact: true }).setInputFiles({
    name: 'selected-real-sessions.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 1, agents, interactions: (source.interactions ?? []).filter((link) => ids.has(link.fromId) && ids.has(link.toId)) })),
  });
  await expect(page.getByRole('heading', { name: 'Meet your little coworkers.' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.import-selection input')).toHaveCount(agents.length);
  await page.getByRole('button', { name: 'Add to this world' }).click();
}
try {
  const host = await newcomer();
  await importAgents(host, source.agents.slice(0, 6));
  await expect(host.locator('.roster-item')).toHaveCount(6);
  await host.getByRole('button', { name: 'Room studio', exact: true }).click();
  await host.getByRole('button', { name: 'Invite', exact: true }).click();
  await host.getByLabel('Agent names, models, and statuses').check();
  await host.getByRole('button', { name: 'Create invitation', exact: true }).click();
  const invitation = await host.getByLabel('Invitation link', { exact: true }).inputValue();
  await host.context().close();
  console.log('Host imported and invitation created.');
  const visitor = await newcomer();
  await importAgents(visitor, source.agents.slice(6));
  await visitor.goto(invitation);
  await expect(visitor.locator('.roster-item')).toHaveCount(6);
  await visitor.getByRole('button', { name: 'Join snapshot with my agents', exact: true }).click();
  await expect(visitor.locator('.roster-item')).toHaveCount(source.agents.length);
  await visitor.goto(invitation);
  await visitor.getByRole('button', { name: 'Join snapshot with my agents', exact: true }).click();
  await expect(visitor.locator('.roster-item')).toHaveCount(source.agents.length);
  await importAgents(visitor, source.agents.slice(6));
  await expect(visitor.locator('.roster-item')).toHaveCount(source.agents.length);
  await visitor.reload();
  await expect(visitor.locator('.roster-item')).toHaveCount(source.agents.length);
  await expect(visitor.locator('[aria-label^="Interactive 3D office"]')).toHaveAttribute('aria-label', `Interactive 3D office · ${Math.max(12, source.agents.length)} desks`);
  await visitor.context().close();
  console.log('Returning visitor joined, deduplicated and refreshed.');
  const late = await newcomer(invitation);
  await late.getByRole('button', { name: 'Join snapshot with my agents', exact: true }).click();
  await importAgents(late, source.agents.slice(6));
  await expect(late.locator('.roster-item')).toHaveCount(source.agents.length);
  await late.waitForTimeout(2200);
  await late.screenshot({ path: 'test-results/joined-room-desktop.png' });
  await late.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => late.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await late.screenshot({ path: 'test-results/joined-room-mobile.png' });
  await late.context().close();
  console.log('New visitor imported into joined room; mobile checked.');
  const invalid = await newcomer();
  if (!await invalid.getByRole('dialog').count()) await invalid.getByRole('button', { name: 'Import agents', exact: true }).click();
  await invalid.getByLabel('Snapshot file', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(invalid.getByRole('alert')).toContainText('not valid JSON');
  await invalid.getByLabel('Snapshot file', { exact: true }).setInputFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"agents":[]}') });
  await expect(invalid.getByRole('heading', { name: 'No sessions in this snapshot.' })).toBeVisible();
  await expect(invalid.getByRole('button', { name: 'Add to this world' })).toBeDisabled();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ url: origin, realSessions: source.agents.length, imports: 'passed', joining: 'passed', repeatJoin: 'deduplicated', refresh: 'passed', mobile: 'passed', invalidAndEmpty: 'passed', pageErrors: errors }));
} finally { await browser.close(); }
