import { applyMove, legalMoves } from './engine';
import type { BoardSpec, State } from './types';
import type { SolveResult } from './solver';

export type Metrics = {
  moves: number;
  expanded: number;
  /** Search states explored per move of the real solution. High = many false paths ruled out. */
  falsePathRatio: number;
  /** Longest run of setup moves the exit piece has to wait through before it can move again. */
  chokepointDepth: number;
  /** Solution states offering 2 or fewer legal moves total: looks stuck, isn't. */
  nearTrapCount: number;
};

const EMPTY_METRICS: Metrics = {
  moves: 0,
  expanded: 0,
  falsePathRatio: 0,
  chokepointDepth: 0,
  nearTrapCount: 0,
};

export function analyze(
  spec: BoardSpec,
  start: State,
  result: SolveResult
): Metrics {
  if (!result.solved)
    return { ...EMPTY_METRICS, expanded: result.effort.expanded };

  let state = start;
  let chokepointDepth = 0;
  let blockRun = 0;
  let nearTrapCount = 0;

  for (const move of result.moves) {
    const options = legalMoves(spec, state);
    if (options.length <= 2) nearTrapCount++;

    if (move.pieceId === spec.exitPieceId) {
      blockRun = 0;
    } else if (!options.some((m) => m.pieceId === spec.exitPieceId)) {
      blockRun++;
      chokepointDepth = Math.max(chokepointDepth, blockRun);
    }

    state = applyMove(state, move);
  }

  return {
    moves: result.moves.length,
    expanded: result.effort.expanded,
    falsePathRatio: result.effort.expanded / result.moves.length,
    chokepointDepth,
    nearTrapCount,
  };
}
