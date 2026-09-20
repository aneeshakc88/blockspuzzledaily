/**
 * node tools/slideblock/run.mjs probe [candidates] [fillMin] [fillMax] [maxCluster]
 *
 * Runs the candidate loop without the accept filter and reports what the rejects cost, which
 * is what sets generation time.
 */
import { DEFAULT_8X8, generateBoard } from '../../src/shared/slideblock/generator';
import type { Candidate } from '../../src/shared/slideblock/generator';

const [budgetArg = '60', fillMin, fillMax, clusterArg] = process.argv.slice(3);

const options = {
  ...DEFAULT_8X8,
  fill: [
    fillMin === undefined ? DEFAULT_8X8.fill[0] : Number(fillMin),
    fillMax === undefined ? DEFAULT_8X8.fill[1] : Number(fillMax),
  ] as [number, number],
  maxCluster: clusterArg === undefined ? DEFAULT_8X8.maxCluster : Number(clusterArg),
  minPar: Number.MAX_SAFE_INTEGER, // never accept: we want the whole candidate distribution
  maxTries: Number(budgetArg),
};

const seen: Candidate[] = [];
const startedAt = Date.now();
generateBoard(1, options, (candidate) => seen.push(candidate));

const byReason = new Map<string, Candidate[]>();
for (const candidate of seen) {
  const key = candidate.rejected ?? 'kept';
  byReason.set(key, [...(byReason.get(key) ?? []), candidate]);
}

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
console.log(
  `fill ${options.fill[0]}-${options.fill[1]}  maxCluster ${options.maxCluster}  ` +
    `${seen.length} candidates in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
);
for (const [reason, group] of byReason) {
  console.log(
    `  ${reason.padEnd(10)} ${String(group.length).padStart(4)}  ` +
      `avg ${(sum(group.map((c) => c.ms)) / group.length).toFixed(0)}ms  ` +
      `avg cluster ${(sum(group.map((c) => c.clusterSize)) / group.length).toFixed(0)}  ` +
      `avg pieces ${(sum(group.map((c) => c.pieces)) / group.length).toFixed(1)}`
  );
}

const pars = seen.filter((c) => c.par >= 0).map((c) => c.par);
pars.sort((a, b) => b - a);
console.log(`  par top10: ${pars.slice(0, 10).join(' ')}`);
