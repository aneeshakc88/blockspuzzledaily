import { describe, expect, it } from 'vitest';
import { applyMove, isSolved, legalMoves } from './engine';
import type { BoardSpec, State } from './types';

const spec: BoardSpec = {
  width: 4,
  height: 1,
  pieces: [{ id: 0, axis: 'horizontal', length: 2, track: 0 }],
  exitPieceId: 0,
  exitEdge: 'right',
};

const start: State = { placements: [{ pieceId: 0, pos: 0 }] };

describe('legalMoves', () => {
  it('offers every stopping distance up to the wall, not just the max slide', () => {
    const moves = legalMoves(spec, start);
    expect(moves).toEqual(
      expect.arrayContaining([
        { pieceId: 0, dir: 1, dist: 1 },
        { pieceId: 0, dir: 1, dist: 2 },
      ])
    );
    expect(moves.some((m) => m.dir === -1)).toBe(false); // already at the left wall
  });
});

describe('applyMove / isSolved', () => {
  it('is unsolved until the exit piece reaches the exit wall', () => {
    expect(isSolved(spec, start)).toBe(false);
    const mid = applyMove(start, { pieceId: 0, dir: 1, dist: 1 });
    expect(isSolved(spec, mid)).toBe(false);
    const solved = applyMove(start, { pieceId: 0, dir: 1, dist: 2 });
    expect(isSolved(spec, solved)).toBe(true);
  });
});
