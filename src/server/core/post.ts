import { reddit } from '@devvit/web/server';
import { ensureScoreThread } from './comment';
import { assignBoard, claimDailyPost } from './daily';
import { dayIndex, dayKey } from './day';

export const createPost = async () => {
  const post = await reddit.submitCustomPost({
    title: `SlideBlock — ${dayKey(dayIndex())}`,
  });

  // Bind the board at creation so every viewer of this post meets the same
  // puzzle; the lazy path in boardIdForPost is only a fallback.
  await assignBoard(post.id);
  // Marks the day as posted so the 01:01 cron skips it.
  await claimDailyPost(post.id);
  // Same for the score thread: scoreThreadId would make one on the first bare
  // score anyway, but creating it here means it is stickied and waiting.
  await ensureScoreThread(post.id);
  return post;
};
