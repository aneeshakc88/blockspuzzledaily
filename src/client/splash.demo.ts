import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../server/trpc';

type Leaderboard = inferRouterOutputs<AppRouter>['daily']['leaderboard'];

/** Stand-in snoos, drawn inline so the preview needs no network. Ranks 1 and 2
 *  are deliberately faceless: the pile must skip them and still field five. */
const FACES: (string | null)[] = [
  null,
  null,
  '#e8552d',
  '#3aa0c4',
  '#7a56c8',
  '#d8a13a',
  '#4fae6a',
  '#c2456f',
];

const snoo = (fill: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100">` +
      `<path d="M30 22V10" stroke="#d8d8d8" stroke-width="3"/>` +
      `<circle cx="30" cy="7" r="4.5" fill="#d8d8d8"/>` +
      `<rect x="20" y="52" width="8" height="34" rx="4" fill="${fill}"/>` +
      `<rect x="32" y="52" width="8" height="34" rx="4" fill="${fill}"/>` +
      `<rect x="16" y="44" width="28" height="34" rx="13" fill="${fill}"/>` +
      `<ellipse cx="30" cy="34" rx="19" ry="16" fill="#f2f2f2"/>` +
      `<ellipse cx="11" cy="32" rx="5" ry="6" fill="#f2f2f2"/>` +
      `<ellipse cx="49" cy="32" rx="5" ry="6" fill="#f2f2f2"/>` +
      `<circle cx="23" cy="33" r="3.4" fill="${fill}"/>` +
      `<circle cx="37" cy="33" r="3.4" fill="${fill}"/>` +
      `</svg>`
  );

const NAMES = [
  'block_wrangler',
  'parsnip',
  'quiet_gears',
  'mossbank',
  'tilt_and_slide',
  'red_one_free',
  'oakhand',
  'nineteen_moves',
];

/**
 * Only reachable from the standalone preview server at `?demo` - the real card
 * never loads this chunk. Lets the podium be designed without live scores.
 */
export const DEMO: Leaderboard = {
  boardId: 0,
  name: 'Tight Quarters',
  par: 14,
  total: 128,
  myRank: 6,
  myPercentile: 5,
  myResult: {
    timeMs: 189_000,
    adjustedMs: 189_000,
    moves: 17,
    hints: 0,
    undos: 2,
    at: Date.now(),
  },
  myAvatar: null,
  profile: { streak: 4, longest: 11, lastDay: 0, solved: 37 },
  username: 'red_one_free',
  top: NAMES.map((username, i) => ({
    rank: i + 1,
    username,
    adjustedMs: 74_000 + i * 23_000,
    avatar: FACES[i] ? snoo(FACES[i]!) : null,
  })),
};
