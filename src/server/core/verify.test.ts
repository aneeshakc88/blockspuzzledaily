import { describe, expect, it } from 'vitest';
import { BANK } from '../../shared/slideblock/bank';
import { solve } from '../../shared/slideblock/solver';
import { verifySolution } from './verify';

const entry = BANK[0]!;
const solution = solve(entry.spec, entry.state).moves;

describe('verifySolution', () => {
  it('accepts a genuine solution', () => {
    expect(verifySolution(entry.spec, entry.state, solution)).toBe(true);
  });

  it('rejects a solution that stops short', () => {
    expect(
      verifySolution(entry.spec, entry.state, solution.slice(0, -1))
    ).toBe(false);
  });

  it('rejects an empty claim', () => {
    expect(verifySolution(entry.spec, entry.state, [])).toBe(false);
  });

  it('rejects a move that slides further than the board allows', () => {
    const tampered = [{ ...solution[0]!, dist: 99 }, ...solution.slice(1)];
    expect(verifySolution(entry.spec, entry.state, tampered)).toBe(false);
  });

  it('rejects a move that walks a piece through another', () => {
    const reversed = [
      { ...solution[0]!, dir: (solution[0]!.dir * -1) as 1 | -1 },
      ...solution.slice(1),
    ];
    expect(verifySolution(entry.spec, entry.state, reversed)).toBe(false);
  });
});
