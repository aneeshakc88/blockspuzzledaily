import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const BANK_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'src/shared/slideblock/bank.json'
);

/** Dev-only endpoint so the editor's Save button can append a board straight to the bank file. */
function bankApi(): Plugin {
  return {
    name: 'slideblock-bank-api',
    configureServer(server) {
      server.middlewares.use('/api/bank', async (req, res) => {
        if (req.method === 'GET') {
          let bank: unknown[] = [];
          try {
            bank = JSON.parse(await fs.readFile(BANK_PATH, 'utf-8'));
          } catch {
            bank = [];
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(bank));
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

        let bank: unknown[] = [];
        try {
          bank = JSON.parse(await fs.readFile(BANK_PATH, 'utf-8'));
        } catch {
          bank = [];
        }
        // id doubles as the board's redis key on the server (leaderboard, par
        // cache, origin post, ...) — a collision would silently cross-wire two
        // puzzles' data, so it comes from the bank itself, not Date.now().
        const nextId =
          bank.length > 0
            ? Math.max(...bank.map((e) => (e as { id: number }).id)) + 1
            : 1;
        const entry = { id: nextId, name: body.name ?? '', spec: body.spec, state: body.state };
        bank.push(entry);
        await fs.writeFile(BANK_PATH, JSON.stringify(bank, null, 2) + '\n', 'utf-8');

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, id: entry.id }));
      });
    },
  };
}

// Standalone config for the slideblock editor dev tool - the devvit plugin in
// vite.config.ts only supports `vite build`, not a live dev server, and this
// tool is never shipped as part of the Reddit app anyway.
export default defineConfig({
  root: 'src/client/editor',
  plugins: [react(), tailwind(), bankApi()],
});
