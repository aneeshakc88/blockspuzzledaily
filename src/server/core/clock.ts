import { redis } from '@devvit/web/server';

const startKey = (boardId: number, username: string) =>
  `pp:start:${boardId}:${username}`;

/** Longer than any real sitting, short enough that a board abandoned mid-solve
 *  eventually forgives its own clock instead of ranking a two-day time. */
const START_TTL_MS = 2 * 24 * 3600 * 1000;

/**
 * The stopwatch lives here, not in the browser. The client only says "I have
 * started" — it never reports a duration, so there is no number for it to forge.
 *
 * nx is the whole point: the first move of an attempt owns the clock, and a
 * reload, a restart, or a forged second call right before submitting all find
 * the clock already running and change nothing.
 */
export async function startClock(
  boardId: number,
  username: string
): Promise<void> {
  await redis.set(startKey(boardId, username), String(Date.now()), {
    nx: true,
    expiration: new Date(Date.now() + START_TTL_MS),
  });
}

/** Elapsed ms, or null when this attempt never started a clock. */
export async function readClock(
  boardId: number,
  username: string
): Promise<number | null> {
  const raw = await redis.get(startKey(boardId, username));
  if (raw === undefined) return null;
  return Math.max(0, Date.now() - Number(raw));
}
