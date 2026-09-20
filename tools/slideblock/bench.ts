/**
 * node tools/slideblock/run.mjs bench [extra.json ...]
 *
 * Solves every board in the bank, plus any board files given, and prints what each one costs
 * the shipping solver.
 */
import { readFileSync } from 'node:fs';

import { BANK } from '../../src/shared/slideblock/bank';
import { solve } from '../../src/shared/slideblock/solver';
import type { BankEntry } from '../../src/shared/slideblock/bank';

const extra: BankEntry[] = process.argv
  .slice(3)
  .flatMap((path) => JSON.parse(readFileSync(path, 'utf8')) as BankEntry[]);

const entries = [...BANK, ...extra];

console.log(
  ['name'.padEnd(16), ' size', 'pieces', ' par', ' expanded', 'generated', '   solve'].join('  ')
);

for (const entry of entries) {
  const result = solve(entry.spec, entry.state);
  console.log(
    [
      entry.name.padEnd(16),
      `${entry.spec.width}x${entry.spec.height}`.padStart(5),
      String(entry.spec.pieces.length).padStart(6),
      String(result.solved ? result.moves.length : -1).padStart(4),
      String(result.effort.expanded).padStart(9),
      String(result.effort.generated).padStart(9),
      `${result.effort.elapsedMs}ms`.padStart(8),
    ].join('  ')
  );
}
