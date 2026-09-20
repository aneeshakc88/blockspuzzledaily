import { redis } from '@devvit/web/server';

/** One bar per minute: bucket 0 is 0-1 min, bucket 1 is 1-2 min, and so on. */
export const BUCKET_MS = 60_000;
export const BUCKET_COUNT = 40;

/**
 * A solve that clocks under a second never reached a human hand - it means the
 * stopwatch started late, not that anyone played that fast. Such a solve still
 * counts (the moves were replayed and verified) but it stays off the
 * leaderboard and out of the histogram rather than sitting at the top of both
 * on 0:00.
 */
export const MIN_RANKED_MS = 1_000;

/**
 * Whether a clock reading is worth ranking. Null is an attempt nothing
 * witnessed; under a second is a stopwatch that started late.
 */
export function isRankable(timeMs: number | null): timeMs is number {
  return timeMs !== null && timeMs >= MIN_RANKED_MS;
}

const lbKey = (boardId: number) => `pp:lb:${boardId}`;
const histKey = (boardId: number) => `pp:hist:${boardId}`;
const resultKey = (boardId: number, username: string) =>
  `pp:res:${boardId}:${username}`;

export type Result = {
  timeMs: number;
  /** What the leaderboard sorts on. Equals timeMs now that hints are gone;
   *  kept so rows written while hints existed still sort by what they scored. */
  adjustedMs: number;
  moves: number;
  /** Always 0. Only old rows carry a real count. */
  hints: number;
  undos: number;
  at: number;
};

export type Standings = {
  rank: number | null;
  total: number;
  /** "Top N%". Null for anyone not on the board yet. */
  percentile: number | null;
  histogram: number[];
  bucketMs: number;
};

export function bucketOf(adjustedMs: number): number {
  return Math.min(Math.floor(adjustedMs / BUCKET_MS), BUCKET_COUNT - 1);
}

export async function resultFor(
  boardId: number,
  username: string
): Promise<Result | null> {
  const raw = await redis.get(resultKey(boardId, username));
  return raw ? (JSON.parse(raw) as Result) : null;
}

/**
 * First completed attempt is the entry, permanently — replays never overwrite
 * it. Without that the board would rank whoever ground it the most.
 */
export async function recordSolve(
  boardId: number,
  username: string,
  result: Result
): Promise<boolean> {
  if (await resultFor(boardId, username)) return false;

  await Promise.all([
    redis.set(resultKey(boardId, username), JSON.stringify(result)),
    redis.zAdd(lbKey(boardId), {
      member: username,
      score: result.adjustedMs,
    }),
    redis.hIncrBy(histKey(boardId), String(bucketOf(result.adjustedMs)), 1),
  ]);
  return true;
}

export type Solver = { rank: number; username: string; adjustedMs: number };

/** The board's fastest solvers, in order. */
export async function topSolvers(
  boardId: number,
  limit: number
): Promise<Solver[]> {
  const rows = await redis.zRange(lbKey(boardId), 0, limit - 1, {
    by: 'rank',
  });
  return rows.map((row, i) => ({
    rank: i + 1,
    username: row.member,
    adjustedMs: row.score,
  }));
}

/** Recomputed on every read, so a board's standings stay live as it fills up. */
export async function standings(
  boardId: number,
  username: string | null
): Promise<Standings> {
  const [total, counts, score] = await Promise.all([
    redis.zCard(lbKey(boardId)),
    redis.hGetAll(histKey(boardId)),
    username
      ? redis.zScore(lbKey(boardId), username)
      : Promise.resolve(undefined),
  ]);

  const histogram = Array.from({ length: BUCKET_COUNT }, (_, i) =>
    Number(counts[String(i)] ?? 0)
  );

  if (score === undefined || !username) {
    return {
      rank: null,
      total,
      percentile: null,
      histogram,
      bucketMs: BUCKET_MS,
    };
  }

  const zeroBased = await redis.zRank(lbKey(boardId), username);
  const rank = (zeroBased ?? 0) + 1;

  return {
    rank,
    total,
    percentile: Math.max(1, Math.ceil((rank / Math.max(total, 1)) * 100)),
    histogram,
    bucketMs: BUCKET_MS,
  };
}
