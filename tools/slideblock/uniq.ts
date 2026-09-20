/** node tools/slideblock/run.mjs uniq -- counts optimal solutions per generated board */
import { readFileSync } from 'node:fs';

import { applyMove, isSolved, legalMoves } from '../../src/shared/slideblock/engine';
import type { BoardSpec, State } from '../../src/shared/slideblock/types';

const path = process.argv[3] ?? 'src/shared/slideblock/generated-8x8.json';
const bank = JSON.parse(readFileSync(path, 'utf8')) as {
  name: string;
  spec: BoardSpec;
  state: State;
}[];

function keyOf(state: State): string {
  let k = '';
  for (const p of state.placements) k += String.fromCharCode(p.pos);
  return k;
}

/** BFS layered; count shortest paths (as move sequences) into every goal at min depth. */
function count(spec: BoardSpec, start: State) {
  const startKey = keyOf(start);
  const paths = new Map<string, number>([[startKey, 1]]);
  const stateBy = new Map<string, State>([[startKey, start]]);
  const seen = new Set<string>([startKey]);
  let frontier = [startKey];
  let depth = 0;

  while (frontier.length > 0) {
    // goals at this depth?
    let goalPaths = 0;
    let goalStates = 0;
    for (const k of frontier) {
      if (isSolved(spec, stateBy.get(k)!)) {
        goalPaths += paths.get(k)!;
        goalStates++;
      }
    }
    if (goalStates > 0) return { par: depth, solutions: goalPaths, goalStates, explored: seen.size };

    const nextPaths = new Map<string, number>();
    for (const k of frontier) {
      const state = stateBy.get(k)!;
      const n = paths.get(k)!;
      for (const move of legalMoves(spec, state)) {
        const child = applyMove(state, move);
        const ck = keyOf(child);
        if (seen.has(ck)) continue;
        stateBy.set(ck, child);
        nextPaths.set(ck, (nextPaths.get(ck) ?? 0) + n);
      }
    }
    for (const k of nextPaths.keys()) seen.add(k);
    for (const [k, v] of nextPaths) paths.set(k, v);
    frontier = [...nextPaths.keys()];
    depth++;
  }
  return { par: -1, solutions: 0, goalStates: 0, explored: seen.size };
}

console.log(['board', ' par', '  optimal solutions', ' goal states'].join('  '));
let uniqueCount = 0;
for (const b of bank) {
  const r = count(b.spec, b.state);
  if (r.solutions === 1) uniqueCount++;
  console.log(
    [
      b.name.padEnd(7),
      String(r.par).padStart(4),
      String(r.solutions).padStart(19),
      String(r.goalStates).padStart(12),
    ].join('  ')
  );
}
console.log(`\n${uniqueCount}/${bank.length} boards have exactly one optimal solution`);
