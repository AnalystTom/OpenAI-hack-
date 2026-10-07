import { parseOfficeSnapshot } from './snapshot.ts';
import type { OfficeSnapshot } from './types';

/** The same privacy boundary is used by the browser, bridge, and relay. */
export function liveMetadata(source: OfficeSnapshot): OfficeSnapshot {
  return { version: 1,
    agents: source.agents.map(({ id, name, harness, model, status, task, contextUsed, contextWindow, updatedAt, activityLabel, character }) => ({
      id, name, harness, model, status, task, contextUsed, contextWindow, updatedAt, activityLabel, character,
    })),
    interactions: source.interactions?.map(({ fromId, toId, at, kind }) => ({ fromId, toId, at, kind })),
  };
}

/** Replace one participant's roster atomically; an empty roster removes their agents. */
export function applyRoomMessage(current: OfficeSnapshot, text: string): OfficeSnapshot {
  const message = JSON.parse(text);
  if (message.type !== 'member') return parseOfficeSnapshot(text);
  if (typeof message.memberId !== 'string' || !/^[a-f0-9-]{36}$/.test(message.memberId)) throw new Error('Invalid room participant.');
  const prefix = `${message.memberId}:`;
  const incoming = parseOfficeSnapshot(JSON.stringify({ version: 1, agents: message.agents, interactions: message.interactions }));
  if (incoming.agents.some(agent => !agent.id.startsWith(prefix))) throw new Error('Invalid participant agent identity.');
  const first = current.agents.findIndex(agent => agent.id.startsWith(prefix));
  const others = current.agents.filter(agent => !agent.id.startsWith(prefix));
  others.splice(first < 0 ? others.length : first, 0, ...incoming.agents);
  return parseOfficeSnapshot(JSON.stringify({ version: 1, agents: others, interactions: [
    ...(current.interactions ?? []).filter(link => !link.fromId.startsWith(prefix) && !link.toId.startsWith(prefix)),
    ...(incoming.interactions ?? []),
  ] }));
}
