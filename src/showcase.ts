import { officeLayout, officePose } from './officeBehavior.ts';
import type { CharacterKind } from './types';

/** Decorative actors only; these never enter session data or real-agent counts. */
export const SHOWCASE_CHARACTERS: { id: string; name: string; kind: CharacterKind; offset: number; tasks: [string, string] }[] = [
  { id: 'showcase-blue', name: 'Blue showcase', kind: 'blue-dot', offset: 0, tasks: ['Sketching a tiny room', 'Trying a color palette'] },
  { id: 'showcase-frog', name: 'Frog showcase', kind: 'frog-dot', offset: 34, tasks: ['Tracing a playful puzzle', 'Sorting tiny ideas'] },
];
export const SHOWCASE_CYCLE_SECONDS = 68;
const stages = [
  { phase: 'arrival', duration: 8, label: 'Arriving' },
  { phase: 'task-one', duration: 16, label: '' },
  { phase: 'task-two', duration: 16, label: '' },
  { phase: 'wander', duration: 16, label: 'Wandering around' },
  { phase: 'leave', duration: 12, label: 'Leaving for another lap' },
] as const;

export function showcaseState(elapsed: number, index: number) {
  const character = SHOWCASE_CHARACTERS[index];
  let time = (elapsed + character.offset) % SHOWCASE_CYCLE_SECONDS;
  for (const stage of stages) {
    if (time < stage.duration) return {
      phase: stage.phase, timeInPhase: time, progress: time / stage.duration,
      status: stage.phase === 'task-one' || stage.phase === 'task-two' ? 'working' as const : 'preview' as const,
      label: stage.phase === 'task-one' ? character.tasks[0] : stage.phase === 'task-two' ? character.tasks[1] : stage.label,
    };
    time -= stage.duration;
  }
  // The modulo above always selects a stage for the animation's nonnegative clock.
  throw new Error('Invalid showcase animation time.');
}

export type ShowcaseState = ReturnType<typeof showcaseState>;

export function showcasePose(index: number, elapsed: number, realTotal: number) {
  const state = showcaseState(elapsed, index);
  const desk = officePose('working', 50 + index, elapsed, realTotal);
  const { carpet } = officeLayout(realTotal);
  const entrance = { x: carpet.x + carpet.width / 2 - 0.5 - index * 1.4, z: carpet.z + 1.1, y: 0.1, facing: 0 };
  const walk = (time: number) => officePose('preview', index, time + SHOWCASE_CHARACTERS[index].offset, realTotal);
  if (state.status === 'working') return desk;
  const from = state.phase === 'arrival' || state.phase === 'wander' ? state.phase === 'arrival' ? entrance : desk : walk(elapsed - state.timeInPhase);
  const to = state.phase === 'arrival' ? desk : state.phase === 'wander' ? walk(elapsed) : entrance;
  const progress = state.phase === 'wander' ? Math.min(1, state.timeInPhase / 2) : state.progress;
  return {
    x: from.x + (to.x - from.x) * progress,
    z: from.z + (to.z - from.z) * progress,
    y: 0.1, facing: state.phase === 'wander' && progress === 1 ? to.facing : Math.atan2(to.x - from.x, to.z - from.z),
    walking: true, sitting: false,
  };
}
