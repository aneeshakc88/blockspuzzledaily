import { afterEach, expect, vi } from 'vitest';
import { test } from '../test';
import { readClock, startClock } from './clock';

const T0 = Date.UTC(2026, 8, 13, 12, 0, 0);

function at(ms: number) {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + ms);
}

afterEach(() => vi.restoreAllMocks());

test('an attempt that never started has no clock', async () => {
  expect(await readClock(1, 'ana')).toBeNull();
});

test('the clock measures from the first move to the answer', async () => {
  at(0);
  await startClock(1, 'ana');
  at(90_000);

  expect(await readClock(1, 'ana')).toBe(90_000);
});

test('starting again does not restart the clock', async () => {
  at(0);
  await startClock(1, 'ana');

  // The forged call: solve at leisure, then claim to be starting now.
  at(300_000);
  await startClock(1, 'ana');
  at(302_000);

  expect(await readClock(1, 'ana')).toBe(302_000);
});

test('each player and each board keeps its own clock', async () => {
  at(0);
  await startClock(1, 'ana');
  at(60_000);
  await startClock(1, 'bo');
  await startClock(2, 'ana');
  at(100_000);

  expect(await readClock(1, 'ana')).toBe(100_000);
  expect(await readClock(1, 'bo')).toBe(40_000);
  expect(await readClock(2, 'ana')).toBe(40_000);
});
