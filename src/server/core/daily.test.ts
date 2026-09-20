import { expect } from 'vitest';
import { test } from '../test';
import {
  assignBoard,
  boardIdForPost,
  claimDailyPost,
  dailyPostId,
  previousDailies,
} from './daily';

test('every post made on one day plays that day\'s board', async () => {
  const first = await assignBoard('t3_a', 100);
  const second = await assignBoard('t3_b', 100);

  expect(second).toBe(first);
  expect(await boardIdForPost('t3_b')).toBe(first);
});

test('a new day deals a new board, and the old post keeps the old one', async () => {
  const yesterday = await assignBoard('t3_old', 100);
  const today = await assignBoard('t3_new', 101);

  expect(today).not.toBe(yesterday);
  expect(await boardIdForPost('t3_old')).toBe(yesterday);
  expect(await boardIdForPost('t3_new')).toBe(today);
});

test('each day lands in the previous-dailies list once', async () => {
  await assignBoard('t3_a', 100);
  await assignBoard('t3_b', 100);
  const today = await assignBoard('t3_c', 101);

  const past = await previousDailies(today);
  expect(past).toHaveLength(1);
  expect(past[0]?.day).toBe(100);
});

test('the first post of a day owns it, later claims do not move it', async () => {
  expect(await dailyPostId(100)).toBeNull();

  await claimDailyPost('t3_first', 100);
  await claimDailyPost('t3_second', 100);

  expect(await dailyPostId(100)).toBe('t3_first');
  expect(await dailyPostId(101)).toBeNull();
});
