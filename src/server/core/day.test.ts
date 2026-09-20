import { describe, expect, it } from 'vitest';
import { dayIndex, dayKey } from './day';

const at = (h: number, m: number, day = 13) =>
  Date.UTC(2026, 8, day, h, m, 0);

describe('streak day boundary', () => {
  it('holds the previous day right up to 01:01 UTC', () => {
    expect(dayIndex(at(1, 0))).toBe(dayIndex(at(12, 0, 12)));
  });

  it('rolls over at 01:01 UTC', () => {
    expect(dayIndex(at(1, 1))).toBe(dayIndex(at(1, 0)) + 1);
  });

  it('labels a day by the date it opens on', () => {
    expect(dayKey(dayIndex(at(1, 1)))).toBe('2026-09-13');
    expect(dayKey(dayIndex(at(1, 0)))).toBe('2026-09-12');
    expect(dayKey(dayIndex(at(23, 59, 12)))).toBe('2026-09-12');
  });

  it('counts consecutive days as consecutive indexes', () => {
    expect(dayIndex(at(9, 0, 14))).toBe(dayIndex(at(9, 0, 13)) + 1);
  });
});
