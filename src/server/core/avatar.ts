import { reddit, redis } from '@devvit/web/server';

/** username -> snoovatar url. Cached for good: avatars change far less often
 *  than this hash is read, and a stale one is a wrong hat, not a wrong score. */
const AVATARS = 'pp:snoo';

/** Looked up in parallel, so keep the caller's list short. */
export async function avatarsFor(
  usernames: string[]
): Promise<Record<string, string>> {
  if (usernames.length === 0) return {};

  const cached = await redis.hGetAll(AVATARS);
  const known: Record<string, string> = {};
  const missing: string[] = [];

  for (const username of usernames) {
    const hit = cached[username];
    if (hit !== undefined) {
      if (hit) known[username] = hit;
    } else {
      missing.push(username);
    }
  }

  if (missing.length === 0) return known;

  const found = await Promise.all(
    missing.map(async (username) => {
      try {
        return [
          username,
          (await reddit.getSnoovatarUrl(username)) ?? '',
        ] as const;
      } catch {
        // Deleted, suspended, or the lookup failed: remember the miss so the
        // next reader does not pay for it again.
        return [username, ''] as const;
      }
    })
  );

  const writes: Record<string, string> = {};
  for (const [username, url] of found) {
    writes[username] = url;
    if (url) known[username] = url;
  }
  await redis.hSet(AVATARS, writes);

  return known;
}
