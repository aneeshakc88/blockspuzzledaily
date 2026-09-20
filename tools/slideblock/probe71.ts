/** Par distribution of tractable 70-75% fill arrangements (one arrangement per seed). */
import { DEFAULT_8X8, generateBoard } from '../../src/shared/slideblock/generator';

const rows: { par: number; cluster: number; pieces: number }[] = [];
let capped = 0;
const t0 = Date.now();
for (let seed = 1; seed <= 150; seed++) {
  generateBoard(
    seed,
    { ...DEFAULT_8X8, fill: [0.7, 0.75], minPar: 0, maxTries: 1, maxCluster: 60_000 },
    (c) => {
      if (c.rejected === 'capped') capped++;
      else if (c.rejected === null || c.rejected === 'too-easy')
        rows.push({ par: c.par, cluster: c.clusterSize, pieces: c.pieces });
    }
  );
}
rows.sort((a, b) => b.par - a.par);
console.log(`tractable ${rows.length}/150, capped ${capped}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log('top pars:', rows.slice(0, 15).map((r) => `${r.par}(cl${r.cluster},p${r.pieces})`).join(' '));
for (const t of [8, 10, 12, 14, 16]) {
  console.log(`par >= ${t}: ${rows.filter((r) => r.par >= t).length}/150 seeds`);
}
