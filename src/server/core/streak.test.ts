import { afterEach, expect, vi } from 'vitest';
import { test } from '../test';
import { creditSolve, profileOf } from './streak';

const DAY_MS = 86_400_000;
/** Noon UTC on an arbitrary day, safely inside one streak day. */
const NOON = Date.UTC(2026, 8, 13, 12, 0, 0);

function on(day: number) {
  vi.spyOn(Date, 'now').mockReturnValue(NOON + day * DAY_MS);
}

afterEach(() => vi.restoreAllMocks());

test('first solve opens a streak', async () => {
  on(0);
  expect((await creditSolve('ana', 1)).streak).toBe(1);
});

test('a second board on the same day does not advance the streak', async () => {
  on(0);
  await creditSolve('ana', 1);
  const after = await creditSolve('ana', 2);
  expect(after.streak).toBe(1);
  expect(after.solved).toBe(2);
});

test('re-solving a board already finished changes nothing', async () => {
  on(0);
  await creditSolve('ana', 1);
  on(1);
  const after = await creditSolve('ana', 1);
  expect(after.streak).toBe(1);
  expect(after.solved).toBe(1);
});

test('a new board the next day advances the streak', async () => {
  on(0);
  await creditSolve('ana', 1);
  on(1);
  expect((await creditSolve('ana', 2)).streak).toBe(2);
});

test('any unplayed board counts, not just that day\'s daily', async () => {
  on(0);
  await creditSolve('ana', 7);
  on(1);
  expect((await creditSolve('ana', 3)).streak).toBe(2);
});

test('skipping a day resets the streak but keeps the record', async () => {
  on(0);
  await creditSolve('ana', 1);
  on(1);
  await creditSolve('ana', 2);
  on(3);
  const after = await creditSolve('ana', 3);
  expect(after.streak).toBe(1);
  expect(after.longest).toBe(2);
  expect(after.solved).toBe(3);
});

test('players keep separate streaks', async () => {
  on(0);
  await creditSolve('ana', 1);
  await creditSolve('bo', 1);
  on(1);
  await creditSolve('ana', 2);
  expect((await profileOf('ana')).streak).toBe(2);
  expect((await profileOf('bo')).streak).toBe(1);
});
