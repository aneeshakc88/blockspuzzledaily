import { initTRPC, TRPCError } from '@trpc/server';
import { transformer } from '../shared/transformer';
import { Context } from './context';
import { context } from '@devvit/web/server';
import { z } from 'zod';
import {
  boardIdForPost,
  entryOf,
  originPostId,
  parOf,
  previousDailies,
} from './core/daily';
import { dayIndex, dayKey } from './core/day';
import {
  isRankable,
  recordSolve,
  resultFor,
  standings,
  topSolvers,
  type Result,
} from './core/scores';
import { avatarsFor } from './core/avatar';
import { creditSolve, profileOf, solvedSet, type Profile } from './core/streak';
import { verifySolution } from './core/verify';
import { readClock, startClock } from './core/clock';
import { commentBody, postComment } from './core/comment';

const t = initTRPC.context<Context>().create({ transformer });

export const router = t.router;
export const publicProcedure = t.procedure;

const NO_PROFILE: Profile = { streak: 0, longest: 0, lastDay: -1, solved: 0 };

/** How far down the leaderboard snoovatars are worth fetching. Deep enough
 *  that the splash face pile can skip avatar-less ranks and still find five. */
const AVATAR_ROWS = 25;
/** Cap on a single leaderboard fetch — high enough that "every solver today"
 *  never actually gets cut. */
const ALL_SOLVERS = 5000;

const moveSchema = z.object({
  pieceId: z.number().int().nonnegative(),
  dir: z.union([z.literal(1), z.literal(-1)]),
  dist: z.number().int().positive().max(64),
});

function requirePost(): string {
  const { postId } = context;
  if (!postId) throw new TRPCError({ code: 'NOT_FOUND', message: 'no post' });
  return postId;
}

function requireUser(): string {
  const { username } = context;
  if (!username)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'log in to play ranked',
    });
  return username;
}

async function boardPayload(boardId: number, username: string | null) {
  const entry = entryOf(boardId);
  const [par, board, result, profile] = await Promise.all([
    parOf(boardId),
    standings(boardId, username),
    username ? resultFor(boardId, username) : Promise.resolve(null),
    username ? profileOf(username) : Promise.resolve(null),
  ]);

  return {
    boardId,
    name: entry.name,
    spec: entry.spec,
    state: entry.state,
    par,
    standings: board,
    result,
    profile,
  };
}

export const appRouter = t.router({
  daily: t.router({
    /** The board this post holds, plus everything the summary screen needs. */
    get: publicProcedure.query(async () => {
      const postId = requirePost();
      const username = context.username ?? null;
      const boardId = await boardIdForPost(postId);
      return { ...(await boardPayload(boardId, username)), username };
    }),

    /** A board reached through Previous Dailies. Ranks on its own leaderboard. */
    board: publicProcedure
      .input(z.object({ boardId: z.number().int().nonnegative() }))
      .query(async ({ input }) => {
        const username = context.username ?? null;
        return { ...(await boardPayload(input.boardId, username)), username };
      }),

    previous: publicProcedure.query(async () => {
      const postId = requirePost();
      const username = context.username ?? null;
      const [current, mine] = await Promise.all([
        boardIdForPost(postId),
        username ? solvedSet(username) : Promise.resolve([]),
      ]);
      const solved = new Set(mine);
      const list = await previousDailies(current);
      return list.map((ref) => ({ ...ref, solved: solved.has(ref.boardId) }));
    }),

    /**
     * Starts the server's stopwatch. Sent on the player's first move — the
     * client never reports a duration, so there is no time for it to forge.
     */
    begin: publicProcedure
      .input(z.object({ boardId: z.number().int().nonnegative() }))
      .mutation(async ({ input }) => {
        const username = requireUser();
        entryOf(input.boardId);
        await startClock(input.boardId, username);
        return { started: true };
      }),

    submit: publicProcedure
      .input(
        z.object({
          boardId: z.number().int().nonnegative(),
          moves: z.array(moveSchema).min(1).max(1000),
          undos: z.number().int().nonnegative().max(5000),
        })
      )
      .mutation(async ({ input }) => {
        const username = requireUser();
        const entry = entryOf(input.boardId);

        if (!verifySolution(entry.spec, entry.state, input.moves))
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'that solution does not solve this board',
          });

        const timeMs = await readClock(input.boardId, username);

        // No clock means nothing witnessed this being played, and a clock that
        // reads under a second means it started late rather than that anyone
        // played that fast. Either way the solve is real - it was replayed move
        // by move - so it still credits the streak; it just has no time worth
        // ranking against timed attempts, and stays out of the histogram.
        if (!isRankable(timeMs)) {
          const [existing, profile, board] = await Promise.all([
            resultFor(input.boardId, username),
            creditSolve(username, input.boardId),
            standings(input.boardId, username),
          ]);
          return {
            fresh: false,
            ranked: existing !== null,
            result: existing,
            standings: board,
            profile,
          };
        }

        const result: Result = {
          timeMs,
          adjustedMs: timeMs,
          moves: input.moves.length,
          hints: 0,
          undos: input.undos,
          at: Date.now(),
        };

        const fresh = await recordSolve(input.boardId, username, result);
        const profile = await creditSolve(username, input.boardId);

        return {
          fresh,
          ranked: true,
          result: fresh ? result : await resultFor(input.boardId, username),
          standings: await standings(input.boardId, username),
          profile,
        };
      }),

    standings: publicProcedure
      .input(z.object({ boardId: z.number().int().nonnegative() }))
      .query(async ({ input }) => {
        return standings(input.boardId, context.username ?? null);
      }),

    /**
     * The feed splash's leaderboard. Avatars are only fetched for the head of
     * the list - the rest render as initials, and a long list is not worth a
     * lookup per row.
     */
    leaderboard: publicProcedure
      .input(
        z.object({
          boardId: z.number().int().nonnegative().optional(),
          // 5 for the splash strip, ALL_SOLVERS for the leaderboard screen —
          // it lists every solver, not a top-N cut.
          limit: z.number().int().positive().max(ALL_SOLVERS).default(5),
        })
      )
      .query(async ({ input }) => {
        const boardId = input.boardId ?? (await boardIdForPost(requirePost()));
        const username = context.username ?? null;

        const [par, top, board, mine, profile] = await Promise.all([
          parOf(boardId),
          topSolvers(boardId, input.limit),
          standings(boardId, username),
          username ? resultFor(boardId, username) : Promise.resolve(null),
          username ? profileOf(username) : Promise.resolve(null),
        ]);

        // The player's own face is worth a lookup even from far down the list.
        const faces = top.slice(0, AVATAR_ROWS).map((s) => s.username);
        if (username && !faces.includes(username)) faces.push(username);
        const avatars = await avatarsFor(faces);

        return {
          boardId,
          name: entryOf(boardId).name,
          par,
          total: board.total,
          myRank: board.rank,
          myPercentile: board.percentile,
          myResult: mine,
          myAvatar: username ? (avatars[username] ?? null) : null,
          profile,
          username,
          top: top.map((solver) => ({
            ...solver,
            avatar: avatars[solver.username] ?? null,
          })),
        };
      }),

    comment: publicProcedure
      .input(
        z.object({
          boardId: z.number().int().nonnegative(),
          note: z.string().max(500),
        })
      )
      .mutation(async ({ input }) => {
        const username = requireUser();
        const result = await resultFor(input.boardId, username);
        if (!result)
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'solve it first',
          });
        const [par, board, profile, origin] = await Promise.all([
          parOf(input.boardId),
          standings(input.boardId, username),
          profileOf(username),
          originPostId(input.boardId),
        ]);

        // A bare score goes under the post's score thread; a note the player
        // actually wrote earns the top level.
        await postComment(
          origin ?? requirePost(),
          commentBody(result, par, board, profile ?? NO_PROFILE, input.note),
          input.note.trim().length === 0
        );
        return { posted: true };
      }),
  }),

  init: t.router({
    get: publicProcedure.query(async () => ({
      postId: context.postId ?? null,
      username: context.username ?? null,
      today: dayKey(dayIndex()),
    })),
  }),
});

export type AppRouter = typeof appRouter;
