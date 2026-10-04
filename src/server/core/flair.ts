import { context, reddit } from '@devvit/web/server';

const CREATOR = 'turbulent-law2331';

const CREATOR_FLAIR = {
  text: 'Nit, Slide Block Creator',
  backgroundColor: '#2e8b3d',
  textColor: 'light',
} as const;

const MEMBER_FLAIR = {
  text: 'Slide Block Founding Member 🐟',
  backgroundColor: '#1e6fd9',
  textColor: 'light',
} as const;

/**
 * Called once a player has posted their score. Never throws — flair is a
 * nicety and must not fail the comment. Anyone with flair already is left
 * alone, except the creator, whose flair is always applied.
 */
export async function awardFlair(username: string): Promise<void> {
  const subredditName = context.subredditName;
  if (!subredditName) return;

  try {
    const isCreator = username.toLowerCase() === CREATOR;

    if (!isCreator) {
      const user = await reddit.getUserByUsername(username);
      const current = await user?.getUserFlairBySubreddit(subredditName);
      if (current?.flairText || current?.flairCssClass) return;
    }

    await reddit.setUserFlair({
      subredditName,
      username,
      ...(isCreator ? CREATOR_FLAIR : MEMBER_FLAIR),
    });
  } catch (e) {
    console.error('flair failed:', e);
  }
}
