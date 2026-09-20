import { describe, expect, it } from 'vitest';
import { analyze } from './metrics';
import { solve } from './solver';
import type { BoardSpec, State } from './types';

describe('analyze', () => {
  it('scores a blocker that must move before the exit piece can', () => {
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
    const metrics = analyze(spec, start, result);

    expect(metrics.moves).toBe(2);
    // The exit piece has zero legal moves at the start: the blocker owns the only cell in its way.
    expect(metrics.chokepointDepth).toBe(1);
    // At the start, only the blocker can move at all (1 option) - looks stuck, isn't.
    expect(metrics.nearTrapCount).toBe(1);
  });

  it('scores a straight run with no blocking at all', () => {
    const spec: BoardSpec = {
      width: 4,
      height: 1,
      pieces: [{ id: 0, axis: 'horizontal', length: 2, track: 0 }],
      exitPieceId: 0,
      exitEdge: 'right',
    };
    const start: State = { placements: [{ pieceId: 0, pos: 0 }] };

    const result = solve(spec, start);
    const metrics = analyze(spec, start, result);

    expect(metrics.chokepointDepth).toBe(0);
  });
});
