/** node tools/slideblock/run.mjs <generate|probe|bench> [args...] */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const entry = process.argv[2];
if (entry !== 'generate' && entry !== 'bench' && entry !== 'probe' && entry !== 'uniq' && entry !== 'probe70' && entry !== 'probe71' && entry !== 'probe72') {
  console.error('usage: node tools/slideblock/run.mjs <generate|probe|bench> [args...]');
  process.exit(1);
}

// esbuild ships only as a transitive dep of the devvit build pack, so resolve it from there.
const require = createRequire(import.meta.url);
const esbuildPath = require.resolve('esbuild', {
  paths: [join(root, 'node_modules', '@devvit', 'build-pack'), root],
});
const esbuild = await import(pathToFileURL(esbuildPath).href);

const bundle = join(mkdtempSync(join(tmpdir(), 'sb-')), `${entry}.mjs`);

await esbuild.build({
  entryPoints: [join(here, `${entry}.ts`)],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  absWorkingDir: root,
});

execFileSync('node', ['--max-old-space-size=8192', bundle, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
});
