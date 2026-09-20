import { makeRng, pick, randomInt } from './rng';
import type { Rng } from './rng';
import type { Axis, BoardSpec, Edge, Piece, Placement, State } from './types';

export type GeneratorOptions = {
  width: number;
  height: number;
  /** Share of cells covered once filling stops. Density is the main lever on cluster size. */
  fill: [min: number, max: number];
  /** Bag drawn from for filler piece length; repeat a value to weight it. */
  lengths: readonly number[];
  exitLength: number;
  exitAxes: readonly Axis[];
  /**
   * Hard ceiling on reachable arrangements. A piece set past it is thrown away rather than
   * shipped as a board the solver needs seconds to crack.
   */
  maxCluster: number;
  minPar: number;
  /** Arrangements tried before generation gives up on a board. */
  maxTries: number;
};

export const DEFAULT_8X8: GeneratorOptions = {
  width: 8,
  height: 8,
  fill: [0.86, 0.94],
  lengths: [2, 2, 2, 3, 3, 4],
  exitLength: 2,
  exitAxes: ['horizontal', 'vertical'],
  maxCluster: 25_000,
  minPar: 16,
  maxTries: 4000,
};

export type GeneratedBoard = {
  seed: number;
  spec: BoardSpec;
  state: State;
  /** Exact optimal move count: the start is the arrangement furthest from any finish. */
  par: number;
  /** Every arrangement the pieces can reach. The solver can never expand more than this. */
  clusterSize: number;
  goalCount: number;
  /** Arrangements rejected before this one landed. */
  tries: number;
};

type PieceMeta = {
  horizontal: boolean;
  length: number;
  track: number;
  trackMax: number;
};

const EXIT_EDGE: Record<Axis, Edge> = {
  horizontal: 'right',
  vertical: 'bottom',
};

/** A random legal arrangement: the exit piece first, then filler until the board is dense. */
function buildArrangement(
  options: GeneratorOptions,
  rng: Rng
): { pieces: Piece[]; positions: Uint8Array; exitAxis: Axis } | null {
  const { width, height } = options;
  const exitAxis = pick(rng, options.exitAxes);
  const grid = new Int32Array(width * height).fill(-1);

  const pieces: Piece[] = [];
  const positions: number[] = [];

  const place = (axis: Axis, length: number, track: number, pos: number): boolean => {
    const horizontal = axis === 'horizontal';
    const span = horizontal ? width : height;
    if (length > span || pos < 0 || pos + length > span) return false;
    const step = horizontal ? 1 : width;
    const base = horizontal ? track * width + pos : pos * width + track;
    for (let i = 0; i < length; i++) {
      if (grid[base + i * step] !== -1) return false;
    }
    const id = pieces.length;
    for (let i = 0; i < length; i++) grid[base + i * step] = id;
    pieces.push({ id, axis, length, track });
    positions.push(pos);
    return true;
  };

  const exitSpan = exitAxis === 'horizontal' ? width : height;
  const exitTrack = randomInt(rng, 0, (exitAxis === 'horizontal' ? height : width) - 1);
  // Seed the walk from a finished board, so every cluster enumerated contains a finish.
  if (!place(exitAxis, options.exitLength, exitTrack, exitSpan - options.exitLength)) return null;

  const cells = width * height;
  const target = Math.round(
    cells * (options.fill[0] + rng() * (options.fill[1] - options.fill[0]))
  );
  let filled = options.exitLength;
  for (let attempt = 0; attempt < cells * 12 && filled < target; attempt++) {
    const axis: Axis = rng() < 0.5 ? 'horizontal' : 'vertical';
    const length = pick(rng, options.lengths);
    const span = axis === 'horizontal' ? width : height;
    const track = randomInt(rng, 0, (axis === 'horizontal' ? height : width) - 1);
    const pos = randomInt(rng, 0, span - length);
    if (place(axis, length, track, pos)) filled += length;
  }

  return { pieces, positions: Uint8Array.from(positions), exitAxis };
}

function metaOf(spec: BoardSpec): PieceMeta[] {
  return spec.pieces.map((piece) => {
    const horizontal = piece.axis === 'horizontal';
    return {
      horizontal,
      length: piece.length,
      track: piece.track,
      trackMax: (horizontal ? spec.width : spec.height) - piece.length,
    };
  });
}

export type Cluster = {
  positions: Uint8Array[];
  neighbours: Int32Array[];
  goals: number[];
  /** True when the ceiling was hit, so the lists are a fragment, not the whole cluster. */
  capped: boolean;
};

/**
 * Walks every arrangement the pieces can reach, capped. Slides are reversible, so the state
 * graph is undirected and one walk from any arrangement covers the whole component.
 */
export function enumerateCluster(
  spec: BoardSpec,
  start: Uint8Array,
  maxCluster: number
): Cluster {
  const meta = metaOf(spec);
  const width = spec.width;
  const grid = new Int32Array(width * spec.height);
  const exitIndex = spec.pieces.findIndex((piece) => piece.id === spec.exitPieceId);
  const atLowEnd = spec.exitEdge === 'left' || spec.exitEdge === 'top';
  const goalPos = atLowEnd ? 0 : meta[exitIndex]!.trackMax;

  const keyOf = (positions: Uint8Array): string => String.fromCharCode(...positions);

  const positions: Uint8Array[] = [start];
  const neighbours: Int32Array[] = [];
  const goals: number[] = [];
  const index = new Map<string, number>([[keyOf(start), 0]]);

  for (let at = 0; at < positions.length; at++) {
    const current = positions[at]!;
    if (current[exitIndex] === goalPos) goals.push(at);

    grid.fill(-1);
    for (let i = 0; i < meta.length; i++) {
      const piece = meta[i]!;
      const step = piece.horizontal ? 1 : width;
      const base = piece.horizontal
        ? piece.track * width + current[i]!
        : current[i]! * width + piece.track;
      for (let cell = 0; cell < piece.length; cell++) grid[base + cell * step] = i;
    }

    const found: number[] = [];
    for (let i = 0; i < meta.length; i++) {
      const piece = meta[i]!;
      const pos = current[i]!;
      for (const dir of [1, -1] as const) {
        for (let probe = pos + dir; probe >= 0 && probe <= piece.trackMax; probe += dir) {
          const front = dir === 1 ? probe + piece.length - 1 : probe;
          const cell = piece.horizontal
            ? piece.track * width + front
            : front * width + piece.track;
          if (grid[cell] !== -1) break;

          const next = Uint8Array.from(current);
          next[i] = probe;
          const key = keyOf(next);
          let to = index.get(key);
          if (to === undefined) {
            to = positions.length;
            index.set(key, to);
            positions.push(next);
            if (positions.length > maxCluster) {
              return { positions, neighbours, goals, capped: true };
            }
          }
          found.push(to);
        }
      }
    }
    neighbours.push(Int32Array.from(found));
  }

  return { positions, neighbours, goals, capped: false };
}

/** Distance from every arrangement to the nearest finish, -1 where unreachable. */
export function distancesToGoal(cluster: Cluster): Int32Array {
  const dist = new Int32Array(cluster.positions.length).fill(-1);
  let frontier = [...cluster.goals];
  for (const goal of frontier) dist[goal] = 0;

  let depth = 0;
  while (frontier.length > 0) {
    depth++;
    const next: number[] = [];
    for (const at of frontier) {
      for (const to of cluster.neighbours[at]!) {
        if (dist[to] !== -1) continue;
        dist[to] = depth;
        next.push(to);
      }
    }
    frontier = next;
  }
  return dist;
}

function toState(spec: BoardSpec, positions: Uint8Array): State {
  const placements: Placement[] = spec.pieces.map((piece, i) => ({
    pieceId: piece.id,
    pos: positions[i]!,
  }));
  return { placements };
}

export type Candidate = {
  tries: number;
  pieces: number;
  clusterSize: number;
  /** Why it was thrown away, or null when it was kept. */
  rejected: 'capped' | 'no-finish' | 'too-easy' | null;
  par: number;
  ms: number;
};

/** One board, or null when `maxTries` arrangements all failed the cluster and par filters. */
export function generateBoard(
  seed: number,
  options: GeneratorOptions = DEFAULT_8X8,
  onCandidate?: (candidate: Candidate) => void
): GeneratedBoard | null {
  const rng = makeRng(seed);

  for (let tries = 1; tries <= options.maxTries; tries++) {
    const startedAt = Date.now();
    const arrangement = buildArrangement(options, rng);
    if (arrangement === null) continue;

    const spec: BoardSpec = {
      width: options.width,
      height: options.height,
      pieces: arrangement.pieces,
      exitPieceId: arrangement.pieces[0]!.id,
      exitEdge: EXIT_EDGE[arrangement.exitAxis],
    };

    const cluster = enumerateCluster(spec, arrangement.positions, options.maxCluster);
    const report = (rejected: Candidate['rejected'], par: number): void =>
      onCandidate?.({
        tries,
        pieces: spec.pieces.length,
        clusterSize: cluster.positions.length,
        rejected,
        par,
        ms: Date.now() - startedAt,
      });

    if (cluster.capped) {
      report('capped', -1);
      continue;
    }
    if (cluster.goals.length === 0) {
      report('no-finish', -1);
      continue;
    }

    const dist = distancesToGoal(cluster);
    let best = 0;
    for (let i = 1; i < dist.length; i++) {
      if (dist[i]! > dist[best]!) best = i;
    }
    const par = dist[best]!;
    if (par < options.minPar) {
      report('too-easy', par);
      continue;
    }
    report(null, par);

    return {
      seed,
      spec,
      state: toState(spec, cluster.positions[best]!),
      par,
      clusterSize: cluster.positions.length,
      goalCount: cluster.goals.length,
      tries,
    };
  }

  return null;
}

export function generateBoards(
  count: number,
  firstSeed: number,
  options: GeneratorOptions = DEFAULT_8X8,
  onCandidate?: (candidate: Candidate) => void
): GeneratedBoard[] {
  const boards: GeneratedBoard[] = [];
  for (let seed = firstSeed; boards.length < count; seed++) {
    const board = generateBoard(seed, options, onCandidate);
    if (board !== null) boards.push(board);
  }
  return boards;
}
