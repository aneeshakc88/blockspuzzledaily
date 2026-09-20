/**
 * Streak days flip at 01:01 UTC — the instant the daily post drops (2:01am CET
 * in winter, 3:01am CEST in summer; Devvit cron is UTC-only, so the boundary is
 * a fixed instant rather than a fixed local hour).
 */
const DAY_OFFSET_MS = 61 * 60 * 1000;
const DAY_MS = 86_400_000;

export function dayIndex(at: number = Date.now()): number {
  return Math.floor((at - DAY_OFFSET_MS) / DAY_MS);
}

export function dayKey(index: number): string {
  return new Date(index * DAY_MS + DAY_OFFSET_MS).toISOString().slice(0, 10);
}
