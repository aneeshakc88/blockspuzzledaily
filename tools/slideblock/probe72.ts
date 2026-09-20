/** Par reachable at 70-75% fill with longer piece bags. One arrangement per seed. */
import { DEFAULT_8X8, generateBoard } from '../../src/shared/slideblock/generator';

const bags = [
  [2, 3, 3, 4, 4],
  [3, 3, 4, 4],
  [3, 4, 4],
  [2, 2, 3, 3, 4, 4, 5],
];

for (const lengths of bags) {
  const rows: { par: number; cluster: number; pieces: number }[] = [];
  let capped = 0;
  const t0 = Date.now();
  for (let seed = 1; seed <= 150; seed++) {
    generateBoard(
      seed,
      { ...DEFAULT_8X8, fill: [0.7, 0.75], lengths, minPar: 0, maxTries: 1, maxCluster: 60_000 },
      (c) => {
        if (c.rejected === 'capped') capped++;
        else rows.push({ par: c.par, cluster: c.clusterSize, pieces: c.pieces });
      }
    );
  }
  rows.sort((a, b) => b.par - a.par);
  const pct = (t: number) => rows.filter((r) => r.par >= t).length;
  console.log(
    `bag[${lengths}] tractable ${rows.length}/150 capped ${capped} ` +
      `par>=10 ${pct(10)} par>=12 ${pct(12)} par>=14 ${pct(14)} par>=16 ${pct(16)} ` +
      `top ${rows.slice(0, 6).map((r) => `${r.par}(cl${r.cluster},p${r.pieces})`).join(' ')} ` +
      `${((Date.now() - t0) / 1000).toFixed(0)}s`
  );
}
