import { describe, expect, it } from 'vitest';
import { solve } from './solver';
import type { BoardSpec, State } from './types';

describe('solve', () => {
  it('finds the one-move solution on an empty straight run', () => {
    const spec: BoardSpec = {
      width: 4,
      height: 1,
      pieces: [{ id: 0, axis: 'horizontal', length: 2, track: 0 }],
      exitPieceId: 0,
      exitEdge: 'right',
    };
    const start: State = { placements: [{ pieceId: 0, pos: 0 }] };

    const result = solve(spec, start);

    expect(result.solved).toBe(true);
    expect(result.moves).toEqual([{ pieceId: 0, dir: 1, dist: 2 }]);
  });

  it('reports unsolved when the exit piece is walled in by a piece that can also never move', () => {
    const spec: BoardSpec = {
      width: 4,
      height: 1,
      pieces: [
        { id: 0, axis: 'horizontal', length: 2, track: 0 },
        { id: 1, axis: 'horizontal', length: 2, track: 0 },
      ],
      exitPieceId: 0,
      exitEdge: 'right',
    };
    const start: State = {
      placements: [
        { pieceId: 0, pos: 0 },
        { pieceId: 1, pos: 2 },
      ],
    };

    const result = solve(spec, start);

    expect(result.solved).toBe(false);
  });

  it('finds the two-move solution once a blocker has to slide out of the way first', () => {
    // Row 0 holds the exit piece; a vertical blocker sits in its path and must drop down first.
    const spec: BoardSpec = {
      width: 4,
      height: 3,
      pieces: [
        { id: 0, axis: 'horizontal', length: 2, track: 0 },
        { id: 1, axis: 'vertical', length: 2, track: 2 },
      ],
      exitPieceId: 0,
      exitEdge: 'right',
    };
    const start: State = {
      placements: [
        { pieceId: 0, pos: 0 },
        { pieceId: 1, pos: 0 },
      ],
    };

    const result = solve(spec, start);

    expect(result.solved).toBe(true);
    expect(result.moves).toEqual([
      { pieceId: 1, dir: 1, dist: 1 },
      { pieceId: 0, dir: 1, dist: 2 },
    ]);
  });
});
