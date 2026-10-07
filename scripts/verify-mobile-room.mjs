import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { userInfo } from 'node:os';

const origin = process.env.DOTS_TEST_URL ?? 'http://127.0.0.1:3000';
const sourceOrigin = process.env.DOTS_TEST_SOURCE_URL ?? origin;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
await mkdir('test-results', { recursive: true });

async function fits(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}

async function touchTarget(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 740 }, { width: 390, height: 844 }]) {
    const errors = [];
    const mobile = viewport.width < 768;
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const host = await context.newPage();
    host.on('pageerror', error => errors.push(error.message));
    host.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await host.goto(origin);
    await expect(host.getByRole('dialog')).toHaveCount(0);
    const showcase = host.getByRole('region', { name: 'Showcase activity', exact: true });
    await expect(showcase).toBeVisible();
    await expect(showcase).toContainText('animated demo');
    await expect(showcase.locator('[data-showcase-id]')).toHaveCount(2);
    await expect(host.locator('.section-heading span')).toHaveText('0');
    await fits(host);
    await expect(host.locator('.roster-item')).toHaveCount(0);
    await expect(host.locator('.first-aid-panel, .agent-vitals')).toHaveCount(0);
    await host.waitForLoadState('networkidle');
    await host.screenshot({ path: `test-results/showcase-default-${viewport.width}x${viewport.height}.png` });
    if (!mobile && process.env.DOTS_TEST_SKIP_CYCLE !== '1') {
      const blue = showcase.locator('[data-showcase-id="showcase-blue"]');
      for (const phase of ['task-one', 'task-two', 'wander', 'leave', 'arrival']) {
        await expect(blue).toHaveAttribute('data-phase', phase, { timeout: 25000 });
        await expect(host.locator('.roster-item')).toHaveCount(0);
        await expect(host.locator('.section-heading span')).toHaveText('0');
        await host.screenshot({ path: `test-results/showcase-${phase}.png` });
      }
    }
    if (mobile) {
      const blue = showcase.locator('[data-showcase-id="showcase-blue"]');
      const initial = await blue.getAttribute('data-phase');
      await expect.poll(() => blue.getAttribute('data-phase'), { timeout: 20000 }).not.toBe(initial);
      await expect(host.locator('.roster-item')).toHaveCount(0);
      await host.screenshot({ path: `test-results/showcase-moving-${viewport.width}x${viewport.height}.png` });
    } else {
      await host.emulateMedia({ reducedMotion: 'reduce' });
      await expect(showcase.locator('[data-showcase-id="showcase-blue"]')).toHaveAttribute('data-phase', 'arrival');
      await host.waitForTimeout(9000);
      await expect(showcase.locator('[data-showcase-id="showcase-blue"]')).toHaveAttribute('data-phase', 'arrival');
      await host.emulateMedia({ reducedMotion: 'no-preference' });
    }
    await host.getByRole('button', { name: 'Import agents', exact: true }).first().click();
    await host.getByLabel('Your name', { exact: true }).fill(userInfo().username);
    await touchTarget(host.getByRole('button', { name: 'Close import', exact: true }));
    await touchTarget(host.getByRole('button', { name: 'Import snapshot file', exact: true }));
    await host.getByRole('button', { name: 'Create live room', exact: true }).last().click();
    await expect(host.getByRole('button', { name: 'Copy live prompt for Codex', exact: true })).toBeVisible();
    await touchTarget(host.locator('summary', { hasText: 'Preview prompt' }));
    await host.locator('summary', { hasText: 'Preview prompt' }).click();
    await expect(host.getByLabel('Codex import prompt')).toHaveValue(/codex-bridge\.mjs/);
    const feedUrl = (await host.getByLabel('Codex import prompt').inputValue()).match(/https?:\/\/[^\s"'<>]+\/api\/live\/rooms\/[a-f0-9-]+\/feed/)?.[0];
    expect(feedUrl).toBeTruthy();
    const snapshotUrl = feedUrl.replace(/\/feed$/, '/snapshot');
    await host.getByRole('button', { name: 'Copy live prompt for Codex', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Copied — paste into Codex', exact: true })).toBeVisible();
    await fits(host);
    await host.getByRole('button', { name: 'Go to live room', exact: true }).click();
    await expect(host.getByText('Live room connected', { exact: true })).toBeVisible();
    await touchTarget(host.getByRole('button', { name: 'Invite someone', exact: true }));
    await host.getByRole('button', { name: 'Invite someone', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Link copied', exact: true })).toBeVisible();
    const invitation = await host.getByLabel('Live room invitation', { exact: true }).inputValue();
    expect(invitation).toMatch(/#live=/);

    const response = await host.request.get(`${sourceOrigin}/api/local-codex/robots?source=workspace`);
    expect(response.ok()).toBe(true);
    const source = await response.json();
    expect(source.agents.length).toBeGreaterThan(0);
    const agents = source.agents.filter(agent => agent.status !== 'offline').slice(0, 2);
    expect(agents).toHaveLength(2);
    await host.getByRole('button', { name: 'Connect my Codex', exact: true }).click();
    await host.getByLabel('Snapshot file', { exact: true }).setInputFiles({ name: 'real-session-metadata.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, agents })) });
    await expect(host.getByRole('heading', { name: 'Meet your little coworkers.' })).toBeVisible();
    await host.getByRole('button', { name: 'Add to this world' }).click();
    await expect(host.locator('.roster-item')).toHaveCount(agents.length);
    await expect(showcase.locator('[data-showcase-id]')).toHaveCount(2);
    await expect(host.locator('.section-heading span')).toHaveText(String(agents.length));
    await host.getByRole('button', { name: 'Pick up toy hammer', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Put down toy hammer', exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'Put down toy hammer', exact: true }).click();
    await fits(host);
    await host.evaluate(() => window.scrollTo(0, 0));
    await host.screenshot({ path: `test-results/mobile-room-${viewport.width}x${viewport.height}.png` });

    const visitorContext = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const visitor = await visitorContext.newPage();
    visitor.on('pageerror', error => errors.push(error.message));
    visitor.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await visitor.goto(invitation);
    await expect(visitor.getByRole('dialog')).toHaveCount(0);
    await visitor.getByRole('button', { name: 'Join with my Codex', exact: true }).click();
    await visitor.getByLabel('Your name', { exact: true }).fill(userInfo().username);
    await visitor.getByRole('button', { name: 'Join this live room', exact: true }).click();
    await expect(visitor.getByRole('button', { name: 'Copy live prompt for Codex', exact: true })).toBeVisible();
    await visitor.getByRole('button', { name: 'Go to live room', exact: true }).click();
    await expect(visitor.getByText('Live room connected', { exact: true })).toBeVisible();
    await expect(visitor.locator('.roster-item')).toHaveCount(agents.length);
    const visibleNames = await visitor.locator('.roster-item b').allTextContents();
    const scopedIds = (await (await visitor.request.get(snapshotUrl)).json()).agents.map(agent => agent.id);
    await visitorContext.setOffline(true);
    await expect(visitor.locator('.roster-item')).toHaveCount(0, { timeout: 15000 });
    await expect(visitor.getByRole('region', { name: 'Showcase activity' }).locator('[data-showcase-id]')).toHaveCount(2);
    await visitorContext.setOffline(false);
    await expect(visitor.locator('.roster-item')).toHaveCount(agents.length, { timeout: 15000 });
    expect(await visitor.locator('.roster-item b').allTextContents()).toEqual(visibleNames);
    expect((await (await visitor.request.get(snapshotUrl)).json()).agents.map(agent => agent.id)).toEqual(scopedIds);
    await fits(visitor);
    await visitor.getByRole('button', { name: 'Room studio', exact: true }).click();
    await expect(visitor.getByRole('dialog', { name: 'Room studio', exact: true })).toBeVisible();
    for (const tab of ['Look', 'Social import', 'Books', 'Projects', 'Invite']) {
      await visitor.getByRole('navigation', { name: 'Room studio sections' }).getByRole('button', { name: tab, exact: true }).click();
      await fits(visitor);
    }
    await visitor.screenshot({ path: `test-results/mobile-studio-${viewport.width}x${viewport.height}.png` });
    await visitor.getByRole('button', { name: 'Close room studio', exact: true }).click();
    await visitor.getByRole('button', { name: 'Disconnect my agents', exact: true }).click();
    await expect(visitor.getByRole('button', { name: 'Join with my Codex', exact: true })).toBeVisible();
    await expect(host.locator('.roster-item')).toHaveCount(agents.length);
    await host.getByRole('button', { name: 'Disconnect my agents', exact: true }).click();
    await expect(host.locator('.roster-item')).toHaveCount(0);
    await expect(visitor.locator('.roster-item')).toHaveCount(0);
    await expect(showcase.locator('[data-showcase-id]')).toHaveCount(2);
    expect(errors).toEqual([]);
    results.push({ viewport, realSessions: agents.length, showcase: 'two labelled demos excluded from real counts', cycle: mobile ? 'phase transition passed' : process.env.DOTS_TEST_SKIP_CYCLE === '1' ? 'skipped by request' : 'full lap passed', reducedMotion: mobile ? 'not requested' : 'freeze passed', reconnect: 'passed', create: 'passed', join: 'passed', import: 'passed', studio: 'passed', overflow: 'none', pageErrors: errors });
    await visitorContext.close();
    await context.close();
  }
  console.log(JSON.stringify({ url: origin, results }, null, 2));
} finally {
  await browser.close();
}
