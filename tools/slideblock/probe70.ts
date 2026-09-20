import { DEFAULT_8X8, generateBoard } from '../../src/shared/slideblock/generator';

const fill: [number, number] = [0.70, 0.75];
const configs = [
  { tag: 'len[2,2,2,3,3,4] cap60k ', lengths: [2, 2, 2, 3, 3, 4], maxCluster: 60_000 },
  { tag: 'len[2,3,3,4,4]   cap40k ', lengths: [2, 3, 3, 4, 4], maxCluster: 40_000 },
  { tag: 'len[3,3,4,4]     cap25k ', lengths: [3, 3, 4, 4], maxCluster: 25_000 },
  { tag: 'len[3,4,4]       cap25k ', lengths: [3, 4, 4], maxCluster: 25_000 },
];

for (const cfg of configs) {
  const tally = { capped: 0, 'no-finish': 0, 'too-easy': 0, kept: 0 };
  let clusterSum = 0;
  let parSum = 0;
  let pieceSum = 0;
  const t0 = Date.now();
  let boards = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const b = generateBoard(
      seed,
      { ...DEFAULT_8X8, fill, lengths: cfg.lengths, maxCluster: cfg.maxCluster, maxTries: 80 },
      (c) => {
        tally[c.rejected ?? 'kept']++;
        if (!c.rejected) {
          clusterSum += c.clusterSize;
          parSum += c.par;
          pieceSum += c.pieces;
        }
      }
    );
    if (b) boards++;
  }
  console.log(
    `${cfg.tag} boards ${boards}/6  capped ${tally.capped}  no-finish ${tally['no-finish']}  ` +
      `too-easy ${tally['too-easy']}  avgCluster ${tally.kept ? Math.round(clusterSum / tally.kept) : 0}  ` +
      `avgPar ${tally.kept ? (parSum / tally.kept).toFixed(1) : 0}  ` +
      `avgPieces ${tally.kept ? (pieceSum / tally.kept).toFixed(1) : 0}  ${((Date.now() - t0) / 1000).toFixed(0)}s`
  );
}
