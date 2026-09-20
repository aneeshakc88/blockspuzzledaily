import { describe, expect, test } from 'vitest';

import { occupancy } from './engine';
import { DEFAULT_8X8, enumerateCluster, generateBoard } from './generator';
import { solve } from './solver';
import type { GeneratorOptions } from './generator';

/** Small and loose: the defaults are tuned for 8x8 and take too long for a unit test. */
const FAST: GeneratorOptions = {
  ...DEFAULT_8X8,
  width: 6,
  height: 6,
  fill: [0.7, 0.8],
  maxCluster: 4_000,
  minPar: 8,
  maxTries: 200,
};

const board = generateBoard(7, FAST);

describe('generateBoard', () => {
  test('produces a board', () => {
    expect(board).not.toBeNull();
  });

  test('is reproducible from its seed', () => {
    expect(generateBoard(7, FAST)).toEqual(board);
  });

  test('starts with every piece in bounds and no two overlapping', () => {
    const { spec, state } = board!;
    const grid = occupancy(spec, state);
    const covered = spec.pieces.reduce((total, piece) => total + piece.length, 0);
    expect(grid.filter((id) => id !== -1)).toHaveLength(covered);
    for (const placement of state.placements) {
      expect(placement.pos).toBeGreaterThanOrEqual(0);
    }
  });

  test('par matches what the shipping solver finds', () => {
    const result = solve(board!.spec, board!.state);
    expect(result.solved).toBe(true);
    expect(result.moves).toHaveLength(board!.par);
  });

  test('honours the par floor and the cluster ceiling', () => {
    expect(board!.par).toBeGreaterThanOrEqual(FAST.minPar);
    expect(board!.clusterSize).toBeLessThanOrEqual(FAST.maxCluster);
  });

  test('the solver never expands more than the cluster it was cut from', () => {
    const result = solve(board!.spec, board!.state);
    expect(result.effort.expanded).toBeLessThanOrEqual(board!.clusterSize);
  });
});

describe('enumerateCluster', () => {
  test('reports capped rather than returning a partial cluster as whole', () => {
    const { spec, state } = board!;
    const start = Uint8Array.from(state.placements.map((p) => p.pos));
    const capped = enumerateCluster(spec, start, 10);
    expect(capped.capped).toBe(true);
    expect(capped.positions.length).toBeGreaterThan(10);
  });

  test('finds at least one finished arrangement', () => {
    const { spec, state } = board!;
    const start = Uint8Array.from(state.placements.map((p) => p.pos));
    const cluster = enumerateCluster(spec, start, FAST.maxCluster);
    expect(cluster.capped).toBe(false);
    expect(cluster.goals.length).toBeGreaterThan(0);
  });
});
