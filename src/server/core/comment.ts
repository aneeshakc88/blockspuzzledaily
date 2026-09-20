import { redis, reddit } from '@devvit/web/server';
import type { Result, Standings } from './scores';
import type { Profile } from './streak';

/** The note rides in a comment posted from the player's own account, so it only
 *  has to be one line — no control characters, no breaking the stat lines apart. */
function flattenNote(note: string): string {
  return note
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function clock(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function commentBody(
  result: Result,
  par: number,
  standings: Standings,
  profile: Profile,
  note: string
): string {
  const lines: string[] = [];

  const clean = flattenNote(note);
  if (clean) lines.push(clean, '');

  lines.push(
    `Freed in **${result.moves} moves** (par ${par}) · **${clock(result.adjustedMs)}**`
  );

  const place =
    standings.rank !== null
      ? `#${standings.rank} of ${standings.total}`
      : `${standings.total} solved`;
  const streak = profile.streak > 0 ? ` · ${profile.streak}-day streak` : '';
  lines.push(`^(${place}${streak})`);

  return lines.join('\n');
}

const stickyKey = (postId: string) => `pp:sticky:${rawId(postId)}`;

const rawId = (postId: string) =>
  postId.startsWith('t3_') ? postId.slice(3) : postId;

const fullPostId = (postId: string) =>
  (postId.startsWith('t3_') ? postId : `t3_${postId}`) as `t3_${string}`;

const fullCommentId = (commentId: string) =>
  (commentId.startsWith('t1_')
    ? commentId
    : `t1_${commentId}`) as `t1_${string}`;

/**
 * The score thread every bare score gets filed under, so the post's top level
 * stays readable. Created as the app and stickied, then remembered — posts made
 * before this existed, and any creation that failed at the time, get one here
 * on first use instead of going without.
 */
export async function scoreThreadId(postId: string): Promise<string | null> {
  const key = stickyKey(postId);
  const known = await redis.get(key);
  if (known !== undefined) return known;

  let sticky;
  try {
    sticky = await reddit.submitComment({
      id: fullPostId(postId),
      text: '**Score Thread** — freed the red block? Post your time here.',
      runAs: 'APP',
    });
  } catch (e) {
    console.error('score thread creation failed:', e);
    return null;
  }

  // Remembered before it is stickied: the comment exists either way, and
  // forgetting its id would mean a fresh score thread per score from here on.
  await redis.set(key, sticky.id);
  try {
    await sticky.distinguish(true);
  } catch (e) {
    // Needs the app to be a mod. Undistinguished is fine — it still collects.
    console.error('score thread sticky failed:', e);
  }
  return sticky.id;
}

/** Called at post creation so the thread is waiting before the first solve. */
export async function ensureScoreThread(postId: string): Promise<void> {
  await scoreThreadId(postId);
}

/**
 * A note is the player's own line and earns the post's top level. A bare score
 * is filed under the score thread, where it does not push conversation down.
 */
export async function postComment(
  postId: string,
  text: string,
  underScoreThread: boolean
): Promise<void> {
  const sticky = underScoreThread ? await scoreThreadId(postId) : null;
  const id = sticky ? fullCommentId(sticky) : fullPostId(postId);
  // Posted from the player's account, not the app's, so the thread reads as theirs.
  await reddit.submitComment({ id, text, runAs: 'USER' });
}
