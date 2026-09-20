import {
  applyMove,
  isSolved,
  legalMoves,
} from '../../shared/slideblock/engine';
import type { BoardSpec, Move, State } from '../../shared/slideblock/types';

/** Replays a claimed solution. Illegal move anywhere, or never solves, and it fails. */
export function verifySolution(
  spec: BoardSpec,
  start: State,
  moves: readonly Move[]
): boolean {
  if (moves.length === 0) return false;
  let state = start;
  for (const move of moves) {
    const legal = legalMoves(spec, state).some(
      (m) =>
        m.pieceId === move.pieceId && m.dir === move.dir && m.dist === move.dist
    );
    if (!legal) return false;
    state = applyMove(state, move);
  }
  return isSolved(spec, state);
}
