import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOWCASE_CHARACTERS, SHOWCASE_CYCLE_SECONDS, showcaseState, showcasePose } from '../src/showcase.ts';
import { officePose } from '../src/officeBehavior.ts';

test('two decorative characters arrive, switch tasks, wander, leave, and repeat', () => {
  assert.equal(SHOWCASE_CHARACTERS.length, 2);
  assert.equal(new Set(SHOWCASE_CHARACTERS.map(character => character.id)).size, 2);
  const times = [0, 8, 24, 40, 56];
  const phases = ['arrival', 'task-one', 'task-two', 'wander', 'leave'];
  for (let index = 0; index < 2; index++) {
    const start = SHOWCASE_CYCLE_SECONDS - SHOWCASE_CHARACTERS[index].offset;
    const states = times.map(time => showcaseState(start + time, index));
    assert.deepEqual(states.map(state => state.phase), phases);
    assert.notEqual(states[1].label, states[2].label, 'the second task has its own label');
    assert.deepEqual(states.map(state => state.status), ['preview', 'working', 'working', 'preview', 'preview']);
    for (const time of times) {
      assert.deepEqual(showcaseState(start + time + SHOWCASE_CYCLE_SECONDS, index), showcaseState(start + time, index));
    }
  }
  assert.notEqual(showcaseState(0, 0).phase, showcaseState(0, 1).phase, 'characters take different laps');
});

test('showcase desks never overlap an actual agent desk', () => {
  for (const total of [0, 2, 12, 50]) {
    const positions = new Set(Array.from({ length: total }, (_, index) => {
      const pose = officePose('working', index, 0, total);
      return `${pose.x}:${pose.z}`;
    }));
    for (let index = 0; index < 2; index++) {
      const workingTime = SHOWCASE_CYCLE_SECONDS - SHOWCASE_CHARACTERS[index].offset + 8;
      const pose = showcasePose(index, workingTime, total);
      const position = `${pose.x}:${pose.z}`;
      assert.equal(pose.sitting, true);
      assert.equal(pose.walking, false);
      assert.equal(positions.has(position), false, 'each demo uses its own desk');
      positions.add(position);
    }
  }
});

test('arrival, wandering, and departure move while work remains seated', () => {
  for (let index = 0; index < 2; index++) {
    const start = SHOWCASE_CYCLE_SECONDS - SHOWCASE_CHARACTERS[index].offset;
    for (const time of [0, 42, 56]) {
      const first = showcasePose(index, start + time, 12);
      const later = showcasePose(index, start + time + 1, 12);
      assert.equal(first.walking, true);
      assert.equal(first.sitting, false);
      assert.ok(Math.hypot(later.x - first.x, later.z - first.z) > 0.02);
    }
    assert.deepEqual(showcasePose(index, start + 10, 12), showcasePose(index, start + 12, 12));
  }
});
