import { describe, expect, it } from 'vitest';
import { BANK, POOL } from './bank';
import { solve } from './solver';

describe('bank', () => {
  // Solving all of BANK serially is slow and gets slower as boards get bigger
  // — an 8x8 runs ~25s on its own, far past the default 5s timeout. Precomputed
  // pars in the bank would let this shrink back to a cheap check.
  it('ships only solvable boards', () => {
    expect(BANK.length).toBeGreaterThan(0);
    for (const entry of BANK) {
      expect(solve(entry.spec, entry.state).solved, entry.name).toBe(true);
    }
  }, 300_000);

  // The four hand-made boards are retired: loose packing gives them a huge
  // state cluster with a short solution, so they solve in seconds, not ms.
  // They stay in BANK so posts already bound to them still resolve.
  it('deals only generated boards, 8x8 and 6x6', () => {
    const sizes = POOL.map((e) => `${e.spec.width}x${e.spec.height}`);
    expect(sizes.filter((s) => s === '8x8').length).toBe(47);
    expect(sizes.filter((s) => s === '6x6').length).toBe(POOL.length - 47);
    expect(new Set(sizes)).toEqual(new Set(['8x8', '6x6']));
    expect(BANK.length - POOL.length).toBe(4);
  });

  // id doubles as the board's redis key on the server (leaderboard, par cache,
  // origin post, ...) — a duplicate would silently cross-wire two puzzles'
  // data, with entryOf()'s plain .find() masking it instead of erroring.
  it('has a unique id per board', () => {
    const ids = BANK.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
