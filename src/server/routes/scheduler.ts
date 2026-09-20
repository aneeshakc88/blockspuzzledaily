import { Hono } from 'hono';
import { dailyPostId } from '../core/daily';
import { dayIndex, dayKey } from '../core/day';
import { createPost } from '../core/post';

export const scheduler = new Hono();

/**
 * 01:01 UTC, the instant dayIndex() rolls over. Idempotent: a mod who already
 * posted today owns the day, and a cron retry finds the claim and stands down.
 */
scheduler.post('/daily-post', async (c) => {
  const day = dayIndex();
  try {
    const claimed = await dailyPostId(day);
    if (claimed)
      return c.json({ status: 'success', message: `${dayKey(day)} already posted as ${claimed}` }, 200);

    const post = await createPost();
    return c.json({ status: 'success', message: `posted ${dayKey(day)} as ${post.id}` }, 200);
  } catch (error) {
    console.error(`Error posting daily: ${error}`);
    return c.json({ status: 'error', message: 'Failed to post daily' }, 500);
  }
});
