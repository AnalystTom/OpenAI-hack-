import { readRobotsSessions } from '../server/codex-sessions.mjs';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { liveMetadata } from '../src/liveRoom.ts';

const { values } = parseArgs({ options: {
  project: { type: 'string' }, sessions: { type: 'string' }, url: { type: 'string' },
  list: { type: 'boolean' }, once: { type: 'boolean' },
} });
if (!values.project) throw new Error('Choose an exact project directory with --project.');
const project = resolve(values.project);
if (values.list) {
  const source = await readRobotsSessions({ project });
  console.log(JSON.stringify(source.agents.map(({ id, name, model, status }) => ({ id, name, model, status })), null, 2));
} else {
  const threadIds = values.sessions?.split(',').filter(Boolean);
  if (!threadIds?.length) throw new Error('First use --list, then select session IDs with --sessions id,id.');
  if (!values.url || !process.env.DOTS_ROOM_UPLOAD_TOKEN) throw new Error('Supply the room feed URL and DOTS_ROOM_UPLOAD_TOKEN from Dots.');
  const url = new URL(values.url);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS for hosted rooms.');
  if (!/^\/api\/live\/rooms\/[a-f0-9-]{36}\/feed$/.test(url.pathname)) throw new Error('Choose a Dots room feed endpoint.');
  let stopped = false;
  let previousBody = '', lastAcceptedAt = 0, failures = 0;
  process.on('SIGINT', () => { stopped = true; });
  process.on('SIGTERM', () => { stopped = true; });
  console.log('Sharing selected Codex session metadata. Keep this terminal open; Ctrl+C stops sharing.');
  do {
    try {
      const source = await readRobotsSessions({ project, threadIds });
      const body = JSON.stringify(liveMetadata(source));
      const changed = body !== previousBody;
      if (!changed && Date.now() - lastAcceptedAt < 10_000) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      const response = await fetch(url, {
        method: changed ? 'PUT' : 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DOTS_ROOM_UPLOAD_TOKEN}` },
        ...(changed ? { body } : {}), signal: AbortSignal.timeout(5000),
      });
      const result = await response.json();
      if (!response.ok) {
        if ([400, 403, 410, 413].includes(response.status) || (changed && response.status === 409)) stopped = true;
        if (!changed && response.status === 409) previousBody = '';
        throw new Error(result.error ?? 'Room upload failed.');
      }
      previousBody = body; lastAcceptedAt = Date.now(); failures = 0;
      if (changed) console.log(`Live update accepted: ${result.accepted} selected sessions.`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Codex feed unavailable.');
      failures++;
      if (values.once) process.exitCode = 1;
    }
    if (!stopped && !values.once) await new Promise(resolve => setTimeout(resolve, failures ? Math.min(30_000, 3000 * 2 ** Math.min(failures, 4)) + Math.random() * 1000 : 3000));
  } while (!stopped && !values.once);
}
