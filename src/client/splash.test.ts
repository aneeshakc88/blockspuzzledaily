import { afterEach, describe, expect, it, vi } from 'vitest';

let requestExpandedModeMock: ReturnType<typeof vi.fn>;

vi.mock('@devvit/web/client', () => {
  requestExpandedModeMock = vi.fn();
  return { requestExpandedMode: requestExpandedModeMock };
});

afterEach(() => {
  requestExpandedModeMock?.mockReset();
});

describe('Splash', () => {
  it('the Play button opens the game in expanded mode', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    // `src/splash.tsx` renders immediately on import (createRoot(...).render(...))
    await import('./splash');

    // Let React commit the initial render.
    await new Promise((r) => setTimeout(r, 0));

    const play = Array.from(document.querySelectorAll('button')).find((b) =>
      /play/i.test(b.textContent ?? '')
    );
    expect(play).toBeTruthy();

    play!.click();

    expect(requestExpandedModeMock).toHaveBeenCalledTimes(1);
    expect(requestExpandedModeMock.mock.calls[0]?.[1]).toBe('game');
  });
});
