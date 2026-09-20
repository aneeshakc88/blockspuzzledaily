import type { BoardSpec, Cell, Move, Piece, Placement, State } from './types';

export function pieceOf(spec: BoardSpec, pieceId: number): Piece {
  const piece = spec.pieces.find((p) => p.id === pieceId);
  if (!piece) throw new Error(`unknown piece ${pieceId}`);
  return piece;
}

export function placementOf(state: State, pieceId: number): Placement {
  const placement = state.placements.find((p) => p.pieceId === pieceId);
  if (!placement) throw new Error(`unplaced piece ${pieceId}`);
  return placement;
}

/** Highest start position the piece can ever hold, wall to wall. */
export function trackMax(spec: BoardSpec, piece: Piece): number {
  const span = piece.axis === 'horizontal' ? spec.width : spec.height;
  return span - piece.length;
}

export function cellsOf(piece: Piece, pos: number): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < piece.length; i++) {
    cells.push(
      piece.axis === 'horizontal'
        ? { x: pos + i, y: piece.track }
        : { x: piece.track, y: pos + i }
    );
  }
  return cells;
}

const DIRS = [1, -1] as const;

/** Reused between legalMoves calls: the search rebuilds this grid millions of times. */
let scratch: Int32Array | null = null;

function scratchGrid(size: number): Int32Array {
  if (scratch === null || scratch.length !== size) scratch = new Int32Array(size);
  return scratch;
}

/** width*height grid of pieceId, -1 where empty. Writes into `into` when given. */
export function occupancy(
  spec: BoardSpec,
  state: State,
  into?: Int32Array
): Int32Array {
  const grid = into ?? new Int32Array(spec.width * spec.height);
  grid.fill(-1);
  for (const placement of state.placements) {
    const piece = pieceOf(spec, placement.pieceId);
    const horizontal = piece.axis === 'horizontal';
    const step = horizontal ? 1 : spec.width;
    let index = horizontal
      ? piece.track * spec.width + placement.pos
      : placement.pos * spec.width + piece.track;
    for (let i = 0; i < piece.length; i++) {
      grid[index] = piece.id;
      index += step;
    }
  }
  return grid;
}

/** How far a piece can slide in one direction before a wall or another piece stops it. */
function slideRoom(
  spec: BoardSpec,
  grid: Int32Array,
  piece: Piece,
  pos: number,
  dir: 1 | -1
): number {
  const max = trackMax(spec, piece);
  const horizontal = piece.axis === 'horizontal';
  let room = 0;
  let probe = pos;
  for (;;) {
    probe += dir;
    if (probe < 0 || probe > max) break;
    const front = dir === 1 ? probe + piece.length - 1 : probe;
    const index = horizontal
      ? piece.track * spec.width + front
      : front * spec.width + piece.track;
    if (grid[index] !== -1) break;
    room++;
  }
  return room;
}

export function legalMoves(spec: BoardSpec, state: State): Move[] {
  const grid = occupancy(spec, state, scratchGrid(spec.width * spec.height));
  const moves: Move[] = [];
  for (const placement of state.placements) {
    const piece = pieceOf(spec, placement.pieceId);
    for (const dir of DIRS) {
      const room = slideRoom(spec, grid, piece, placement.pos, dir);
      for (let dist = 1; dist <= room; dist++) {
        moves.push({ pieceId: piece.id, dir, dist });
      }
    }
  }
  return moves;
}

export function applyMove(state: State, move: Move): State {
  return {
    placements: state.placements.map((p) =>
      p.pieceId === move.pieceId
        ? { pieceId: p.pieceId, pos: p.pos + move.dir * move.dist }
        : p
    ),
  };
}

export function isSolved(spec: BoardSpec, state: State): boolean {
  const piece = pieceOf(spec, spec.exitPieceId);
  const placement = placementOf(state, spec.exitPieceId);
  const max = trackMax(spec, piece);
  switch (spec.exitEdge) {
    case 'left':
    case 'top':
      return placement.pos === 0;
    case 'right':
    case 'bottom':
      return placement.pos === max;
  }
}
