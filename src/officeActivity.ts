import type { OfficeAgent } from './types';

export const DISCONNECTED_RETENTION_MS = 30 * 60_000;

export function agentDisplayName(agent: OfficeAgent): string {
  return agent.ownerName?.trim() || agent.name;
}

export function agentIsVisible(agent: OfficeAgent, now = Date.now()): boolean {
  return agent.status !== 'offline' || now - Date.parse(agent.disconnectedAt ?? agent.updatedAt) < DISCONNECTED_RETENTION_MS;
}

export function agentActivityLabel(agent: OfficeAgent): string | undefined {
  if (agent.status !== 'working') return undefined;
  return agent.activityLabel || (agent.health?.retrying ? 'Retrying a failed step' : undefined);
}

export function officeSummary(agents: OfficeAgent[]): string {
  if (!agents.length) return 'No Codex sessions connected. Import your agents to join.';
  const count = (status: string) => agents.filter(agent => agent.status === status).length;
  const working = count('working'), chilling = count('idle');
  const attention = count('blocked') + count('error');
  const disconnected = count('offline'), unknown = count('unknown');
  return `${working} working · ${chilling} chilling${attention ? ` · ${attention} need help` : ''}${disconnected ? ` · ${disconnected} disconnected` : ''}${unknown ? ` · ${unknown} unconfirmed` : ''}`;
}
