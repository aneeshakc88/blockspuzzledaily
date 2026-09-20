import { expect } from 'vitest';
import { test } from '../test';
import {
  bucketOf,
  isRankable,
  MIN_RANKED_MS,
  recordSolve,
  resultFor,
  standings,
  topSolvers,
  type Result,
} from './scores';

const result = (adjustedMs: number, over: Partial<Result> = {}): Result => ({
  timeMs: adjustedMs,
  adjustedMs,
  moves: 24,
  hints: 0,
  undos: 0,
  at: 0,
  ...over,
});

test('a solve lands on the board and comes back', async () => {
  await recordSolve(9, 'ana', result(120_000));
  expect((await resultFor(9, 'ana'))?.adjustedMs).toBe(120_000);
});

test('the first attempt is the entry, replays never overwrite it', async () => {
  await recordSolve(9, 'ana', result(300_000));
  const again = await recordSolve(9, 'ana', result(30_000));

  expect(again).toBe(false);
  expect((await resultFor(9, 'ana'))?.adjustedMs).toBe(300_000);
  expect((await standings(9, 'ana')).total).toBe(1);
});

test('ranks by adjusted time, fastest first', async () => {
  await recordSolve(9, 'ana', result(120_000));
  await recordSolve(9, 'bo', result(60_000));
  await recordSolve(9, 'cy', result(200_000));

  expect((await standings(9, 'bo')).rank).toBe(1);
  expect((await standings(9, 'ana')).rank).toBe(2);
  expect((await standings(9, 'cy')).rank).toBe(3);
});

// Hints are gone, but rows written while they existed carry a penalised
// adjustedMs — they must keep ranking on that, not on their raw clock.
test('a legacy penalised row ranks on its adjusted time', async () => {
  await recordSolve(9, 'ana', result(190_000, { timeMs: 130_000, hints: 2 }));
  await recordSolve(9, 'bo', result(150_000));

  expect((await standings(9, 'bo')).rank).toBe(1);
  expect((await standings(9, 'ana')).rank).toBe(2);
});

test('reports the field and where you sit in it', async () => {
  for (let i = 0; i < 10; i++) {
    await recordSolve(9, `p${i}`, result(60_000 + i * 10_000));
  }
  const board = await standings(9, 'p0');

  expect(board.total).toBe(10);
  expect(board.rank).toBe(1);
  expect(board.percentile).toBe(10);
  // 60s through 110s all fall in the same minute-wide bucket.
  expect(board.histogram[bucketOf(60_000)]).toBe(6);
  expect(board.histogram.reduce((a, b) => a + b, 0)).toBe(10);
});

test('a viewer who has not solved gets the field but no rank', async () => {
  await recordSolve(9, 'ana', result(120_000));
  const board = await standings(9, null);

  expect(board.rank).toBeNull();
  expect(board.percentile).toBeNull();
  expect(board.total).toBe(1);
});

test('boards keep their own leaderboards', async () => {
  await recordSolve(9, 'ana', result(120_000));
  await recordSolve(10, 'bo', result(120_000));

  expect((await standings(9, 'ana')).total).toBe(1);
  expect((await standings(10, 'ana')).rank).toBeNull();
});

test('topSolvers reads the board in rank order', async () => {
  await recordSolve(9, 'ana', result(120_000));
  await recordSolve(9, 'bo', result(60_000));
  await recordSolve(9, 'cy', result(200_000));

  expect(await topSolvers(9, 10)).toEqual([
    { rank: 1, username: 'bo', adjustedMs: 60_000 },
    { rank: 2, username: 'ana', adjustedMs: 120_000 },
    { rank: 3, username: 'cy', adjustedMs: 200_000 },
  ]);
  expect((await topSolvers(9, 2)).map((s) => s.username)).toEqual([
    'bo',
    'ana',
  ]);
});

test('topSolvers on a board nobody has solved is empty', async () => {
  expect(await topSolvers(404, 10)).toEqual([]);
});

// A sub-second clock means the stopwatch started late, not that anyone played
// that fast. Such a solve stays off the leaderboard and out of the histogram
// rather than heading both at 0:00.
test('a sub-second clock does not rank', () => {
  expect(isRankable(0)).toBe(false);
  expect(isRankable(40)).toBe(false);
  expect(isRankable(MIN_RANKED_MS - 1)).toBe(false);
});

test('a real clock ranks, and an attempt nothing witnessed does not', () => {
  expect(isRankable(MIN_RANKED_MS)).toBe(true);
  expect(isRankable(90_000)).toBe(true);
  expect(isRankable(null)).toBe(false);
});
