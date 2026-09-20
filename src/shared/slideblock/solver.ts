import { applyMove, isSolved, legalMoves, pieceOf, trackMax } from './engine';
import type { BoardSpec, Move, State } from './types';

export type SearchEffort = {
  expanded: number;
  generated: number;
  elapsedMs: number;
};

export type SolveResult = {
  solved: boolean;
  /** Shortest move sequence found. Empty when unsolved. */
  moves: Move[];
  effort: SearchEffort;
};

const DEFAULT_MAX_NODES = 500_000;

/** A packed board label: an integer where positions fit one, a compact string otherwise. */
type Key = number | string;

type ParentLink = { prevKey: Key; move: Move };

/**
 * Builds the labeller for the visited set. Placement order is fixed the moment a board is
 * loaded and applyMove preserves it, so the positions alone - in that order - name a board.
 */
function makeKeyOf(spec: BoardSpec, start: State): (state: State) => Key {
  let maxPos = 0;
  for (const placement of start.placements) {
    maxPos = Math.max(maxPos, trackMax(spec, pieceOf(spec, placement.pieceId)));
  }
  const radix = maxPos + 1;

  let capacity = 1;
  for (let i = 0; i < start.placements.length; i++) capacity *= radix;

  if (capacity > Number.MAX_SAFE_INTEGER) {
    return (state) => {
      let key = '';
      for (const placement of state.placements) {
        key += String.fromCharCode(placement.pos);
      }
      return key;
    };
  }

  return (state) => {
    let key = 0;
    for (const placement of state.placements) key = key * radix + placement.pos;
    return key;
  };
}

/**
 * Breadth-first search. Every move costs 1 regardless of slide distance, so BFS depth is the
 * true optimal move count - no heuristic needed at this board size.
 */
export function solve(
  spec: BoardSpec,
  start: State,
  maxNodes = DEFAULT_MAX_NODES
): SolveResult {
  const startedAt = Date.now();
  const keyOf = makeKeyOf(spec, start);
  const startKey = keyOf(start);

  if (isSolved(spec, start)) {
    return {
      solved: true,
      moves: [],
      effort: { expanded: 0, generated: 1, elapsedMs: 0 },
    };
  }

  const parent = new Map<Key, ParentLink>();
  const stateByKey = new Map<Key, State>([[startKey, start]]);
  let frontier: Key[] = [startKey];
  let expanded = 0;
  let generated = 1;

  while (frontier.length > 0) {
    const next: Key[] = [];
    for (const key of frontier) {
      const state = stateByKey.get(key)!;
      expanded++;
      if (expanded > maxNodes) {
        return {
          solved: false,
          moves: [],
          effort: { expanded, generated, elapsedMs: Date.now() - startedAt },
        };
      }

      for (const move of legalMoves(spec, state)) {
        const child = applyMove(state, move);
        const childKey = keyOf(child);
        if (childKey === startKey || parent.has(childKey)) continue;

        parent.set(childKey, { prevKey: key, move });
        stateByKey.set(childKey, child);
        generated++;

        if (isSolved(spec, child)) {
          return {
            solved: true,
            moves: tracePath(parent, childKey),
            effort: { expanded, generated, elapsedMs: Date.now() - startedAt },
          };
        }
        next.push(childKey);
      }
    }
    frontier = next;
  }

  return {
    solved: false,
    moves: [],
    effort: { expanded, generated, elapsedMs: Date.now() - startedAt },
  };
}

function tracePath(parent: Map<Key, ParentLink>, goalKey: Key): Move[] {
  const moves: Move[] = [];
  for (let key = goalKey; parent.has(key);) {
    const link = parent.get(key)!;
    moves.push(link.move);
    key = link.prevKey;
  }
  return moves.reverse();
}
