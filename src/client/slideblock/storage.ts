const KEY = 'slideblock:v2';

/** Only the sound preference lives locally now — results and progress are server-side. */
export function loadMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === 'muted';
  } catch {
    return false;
  }
}

export function storeMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? 'muted' : 'on');
  } catch {
    // Storage blocked in this webview: the preference lasts the session only.
  }
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
