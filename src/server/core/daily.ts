import { redis } from '@devvit/web/server';
import { BANK, POOL, type BankEntry } from '../../shared/slideblock/bank';
import { solve } from '../../shared/slideblock/solver';
import { dayIndex, dayKey } from './day';

/** Which board a given post shows. */
const postBoardKey = (postId: string) => `pp:post:${postId}`;
/** The one board a day is playing. Every post made that day points at it. */
const dayBoardKey = (day: number) => `pp:day:${day}`;
/** First post of a day, so the cron does not post twice over one day. */
const dayPostKey = (day: number) => `pp:daypost:${day}`;
/** boardId -> postId it first went out in. Doubles as the used-board set. */
const ORIGIN = 'pp:origin';
/** boardId -> day it went out, for the Previous Dailies list. */
const DAILIES = 'pp:dailies';
const PAR = 'pp:par';

export function entryOf(boardId: number): BankEntry {
  const entry = BANK.find((e) => e.id === boardId);
  if (!entry) throw new Error(`unknown board ${boardId}`);
  return entry;
}

/**
 * Deals boards like cards, not dice: a board that has already been a daily is
 * out of the pool, so nobody meets the same puzzle twice while the bank lasts.
 * Once the bank is exhausted it falls back to reuse - the generator is meant to
 * stay ahead of the cron, and an empty pool should not block a post.
 */
async function mintDayBoard(day: number, postId: string): Promise<number> {
  const used = await redis.hGetAll(ORIGIN);
  const free = POOL.filter((entry) => used[String(entry.id)] === undefined);
  const pool = free.length > 0 ? free : POOL;
  const pick = pool[Math.floor(Math.random() * pool.length)]!;

  // nx, then read back: two posts minted in the same instant still agree on one
  // board, and the loser drops its pick rather than burning it.
  await redis.set(dayBoardKey(day), String(pick.id), { nx: true });
  const held = Number(await redis.get(dayBoardKey(day)));
  if (held !== pick.id) return held;

  await Promise.all([
    redis.hSet(ORIGIN, { [String(pick.id)]: postId }),
    redis.zAdd(DAILIES, { member: String(pick.id), score: day }),
  ]);
  return pick.id;
}

/**
 * Binds a post to its day's puzzle. The board belongs to the day, not the post:
 * a mod making a second post today lands on the same board as the first, while
 * yesterday's post keeps yesterday's.
 */
export async function assignBoard(
  postId: string,
  day: number = dayIndex()
): Promise<number> {
  const today = await redis.get(dayBoardKey(day));
  const boardId = today ? Number(today) : await mintDayBoard(day, postId);

  await redis.set(postBoardKey(postId), String(boardId));
  return boardId;
}

/** The day's first post, if one exists yet. */
export async function dailyPostId(
  day: number = dayIndex()
): Promise<string | null> {
  return (await redis.get(dayPostKey(day))) ?? null;
}

/** First writer wins, so a mod post and the cron cannot both claim the day. */
export async function claimDailyPost(
  postId: string,
  day: number = dayIndex()
): Promise<void> {
  await redis.set(dayPostKey(day), postId, { nx: true });
}

export async function boardIdForPost(postId: string): Promise<number> {
  const existing = await redis.get(postBoardKey(postId));
  return existing ? Number(existing) : assignBoard(postId);
}

export async function originPostId(boardId: number): Promise<string | null> {
  return (await redis.hGet(ORIGIN, String(boardId))) ?? null;
}

/** Optimal move count. Searched once per board, then cached for good. */
export async function parOf(boardId: number): Promise<number> {
  const cached = await redis.hGet(PAR, String(boardId));
  if (cached !== undefined) return Number(cached);

  const entry = entryOf(boardId);
  const par = solve(entry.spec, entry.state).moves.length;
  await redis.hSet(PAR, { [String(boardId)]: String(par) });
  return par;
}

export type DailyRef = { boardId: number; day: number; date: string };

/** Past dailies, newest first, excluding the one currently open. */
export async function previousDailies(
  exclude: number,
  limit = 60
): Promise<DailyRef[]> {
  const size = await redis.zCard(DAILIES);
  if (size === 0) return [];

  const rows = await redis.zRange(DAILIES, 0, size - 1, { by: 'rank' });
  return rows
    .reverse()
    .map((row) => ({
      boardId: Number(row.member),
      day: row.score,
      date: dayKey(row.score),
    }))
    .filter((ref) => ref.boardId !== exclude)
    .slice(0, limit);
}
