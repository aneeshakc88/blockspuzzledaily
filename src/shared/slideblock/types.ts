export type Axis = 'horizontal' | 'vertical';
export type Edge = 'left' | 'right' | 'top' | 'bottom';

export type Piece = {
  id: number;
  axis: Axis;
  /** Cells long, along its own axis. Thickness across the axis is always 1. */
  length: number;
  /** Fixed row (horizontal piece) or column (vertical piece) it slides along. */
  track: number;
};

export type BoardSpec = {
  width: number;
  height: number;
  pieces: readonly Piece[];
  exitPieceId: number;
  /** Must be left/right for a horizontal exit piece, top/bottom for a vertical one. */
  exitEdge: Edge;
};

export type Placement = {
  pieceId: number;
  /** Start cell along the piece's axis, 0-based. */
  pos: number;
};

export type State = {
  placements: readonly Placement[];
};

export type Move = {
  pieceId: number;
  dir: 1 | -1;
  dist: number;
};

export type Cell = { x: number; y: number };
