/**
 * node tools/slideblock/run.mjs generate <out.json> [count] [firstSeed] [fillMin-fillMax]
 *   [maxCluster] [lengths,csv] [minPar]
 *
 * Generates 8x8 boards, verifies each one with the shipping solver, and writes them in
 * bank.json shape so they can be dropped straight into the bank.
 */
import { writeFileSync } from 'node:fs';

import { DEFAULT_8X8, generateBoard } from '../../src/shared/slideblock/generator';
import { analyze } from '../../src/shared/slideblock/metrics';
import { solve } from '../../src/shared/slideblock/solver';
import type { GeneratedBoard, GeneratorOptions } from '../../src/shared/slideblock/generator';

const [
  outPath = 'tools/slideblock/generated-8x8.json',
  countArg = '20',
  seedArg = '1',
  fillArg = '',
  clusterArg = '',
  lengthsArg = '',
  minParArg = '',
] = process.argv.slice(3);

const count = Number(countArg);
const firstSeed = Number(seedArg);

const options: GeneratorOptions = { ...DEFAULT_8X8 };
if (fillArg) {
  const [min, max] = fillArg.split('-').map(Number);
  options.fill = [min!, max!];
}
if (clusterArg) options.maxCluster = Number(clusterArg);
if (lengthsArg) options.lengths = lengthsArg.split(',').map(Number);
if (minParArg) options.minPar = Number(minParArg);

const boards: GeneratedBoard[] = [];
const startedAt = Date.now();
let candidates = 0;

console.log(
  [' #', ' seed', 'pieces', 'fill', ' par', ' cluster', ' expanded', '   solve', ' false', '     gen'].join(
    '  '
  )
);

for (let seed = firstSeed; boards.length < count; seed++) {
  const genStart = Date.now();
  const board = generateBoard(seed, options, () => {
    candidates++;
  });
  if (board === null) continue;
  const genMs = Date.now() - genStart;

  // The filler stops at the first placement past the target, so a long piece can overshoot
  // the requested band. Drop those rather than ship a board outside the asked-for density.
  const cells = board.spec.width * board.spec.height;
  const fill = board.spec.pieces.reduce((sum, piece) => sum + piece.length, 0) / cells;
  if (fill < options.fill[0] || fill > options.fill[1]) continue;

  // Verify with the solver the game actually ships, not the generator's own walk.
  const result = solve(board.spec, board.state);
  const metrics = analyze(board.spec, board.state, result);
  if (!result.solved || result.moves.length !== board.par) {
    throw new Error(
      `seed ${seed}: solver says ${result.moves.length}, generator says ${board.par}`
    );
  }

  boards.push(board);
  console.log(
    [
      String(boards.length).padStart(2),
      String(seed).padStart(5),
      String(board.spec.pieces.length).padStart(6),
      `${(100 * fill).toFixed(0)}%`.padStart(4),
      String(board.par).padStart(4),
      String(board.clusterSize).padStart(8),
      String(result.effort.expanded).padStart(9),
      `${result.effort.elapsedMs}ms`.padStart(8),
      metrics.falsePathRatio.toFixed(0).padStart(6),
      `${genMs}ms`.padStart(8),
    ].join('  ')
  );
}

console.log(
  `\n${boards.length} boards from ${candidates} candidates in ` +
    `${((Date.now() - startedAt) / 1000).toFixed(1)}s`
);

const bank = boards.map((board, i) => ({
  id: 1790000000000 + i,
  name: `gen8-${board.seed}`,
  spec: board.spec,
  state: board.state,
}));

writeFileSync(outPath, `${JSON.stringify(bank, null, 2)}\n`);
console.log(`wrote ${outPath}`);
