import { redis } from '@devvit/web/server';
import { dayIndex } from './day';

const profileKey = (username: string) => `pp:user:${username}`;
const solvedKey = (username: string) => `pp:solved:${username}`;

export type Profile = {
  streak: number;
  longest: number;
  /** Day the streak last advanced. */
  lastDay: number;
  solved: number;
};

const FRESH: Profile = { streak: 0, longest: 0, lastDay: -1, solved: 0 };

export async function profileOf(username: string): Promise<Profile> {
  const raw = await redis.get(profileKey(username));
  return raw ? { ...FRESH, ...(JSON.parse(raw) as Partial<Profile>) } : FRESH;
}

export async function hasSolved(
  username: string,
  boardId: number
): Promise<boolean> {
  return (await redis.hGet(solvedKey(username), String(boardId))) !== undefined;
}

export async function solvedSet(username: string): Promise<number[]> {
  const all = await redis.hGetAll(solvedKey(username));
  return Object.keys(all).map(Number);
}

/**
 * A day counts once, for a board you have never finished before — otherwise the
 * same easy board could be re-solved from memory every morning forever. Which
 * board it is does not matter, so a missed daily can be covered by anything
 * still unplayed in the back catalogue.
 */
export async function creditSolve(
  username: string,
  boardId: number
): Promise<Profile> {
  const current = await profileOf(username);
  if (await hasSolved(username, boardId)) return current;

  const today = dayIndex();
  const streak =
    current.lastDay === today
      ? current.streak
      : current.lastDay === today - 1
        ? current.streak + 1
        : 1;

  const next: Profile = {
    streak,
    longest: Math.max(current.longest, streak),
    lastDay: today,
    solved: current.solved + 1,
  };

  await Promise.all([
    redis.hSet(solvedKey(username), { [String(boardId)]: '1' }),
    redis.set(profileKey(username), JSON.stringify(next)),
  ]);
  return next;
}
