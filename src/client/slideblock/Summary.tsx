import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../server/trpc';
import { Icon } from './icons';
import { clock } from './storage';
import clsx from 'clsx';

type Outputs = inferRouterOutputs<AppRouter>;
type Standings = Outputs['daily']['standings'];
type Result = NonNullable<Outputs['daily']['submit']['result']>;
type Profile = Outputs['daily']['submit']['profile'];

/** Server's answer when it ranked the solve, or a local stand-in when it could not. */
export type Outcome = {
  fresh: boolean;
  /** False when the time shown is the player's own clock rather than the
   *  server's, so it carries no rank. */
  ranked: boolean;
  result: Result | null;
  standings: Standings;
  profile: Profile | null;
};

type SummaryProps = {
  par: number;
  outcome: Outcome;
  username: string | null;
  onComment: (note: string) => Promise<boolean>;
  onPrevious: () => void;
  onReplay: () => void;
};

/** A lone solver still needs a chart, but not a row of empty minutes. */
const MIN_BARS = 3;
/** Buckets 0-7 stay per-minute; 8 minutes and slower collapse into one
 *  "8m+" bar on the chart only — the server histogram keeps its real
 *  per-minute buckets, this folding is display-only. */
const FOLD_AT = 8;

/** Drops trailing empty bars, but never past MIN_BARS or past the solver's own bar. */
function frame(bars: number[], mine: number) {
  let last = bars.length - 1;
  while (last > mine && last > MIN_BARS - 1 && bars[last] === 0) last--;
  return bars.slice(0, last + 1);
}

const Distribution = ({
  standings,
  adjustedMs,
  ranked,
}: {
  standings: Standings;
  adjustedMs: number;
  /** An unranked solve was never counted into these bars, so it does not get
   *  one of its own - the chart shows the field, with nobody marked as you. */
  ranked: boolean;
}) => {
  const bucket = Math.min(
    Math.floor(adjustedMs / standings.bucketMs),
    standings.histogram.length - 1
  );
  // Fold everything 8 minutes and slower into one bar. Chart-only: the
  // server histogram itself still tracks real per-minute buckets.
  const folded = [
    ...standings.histogram.slice(0, FOLD_AT),
    standings.histogram.slice(FOLD_AT).reduce((sum, n) => sum + n, 0),
  ];
  const mine = ranked ? Math.min(bucket, FOLD_AT) : -1;
  const bars = frame(folded, mine);
  const peak = Math.max(...bars, 1);
  const here = mine;
  /** Enough spacing that tick labels never run into each other. */
  const step = Math.max(1, Math.ceil(bars.length / 6));
  const mins = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const tick = (i: number) => {
    // Your own bucket always names its minutes - the dotted guide in the plot
    // is what says "you", so the axis is free to stay an axis. Its neighbours
    // stand down instead, the way they already did around the old You label.
    if (i !== here) {
      if (i % step !== 0) return '';
      if (here >= 0 && Math.abs(i - here) < step) return '';
    }
    if (i === FOLD_AT) return `${FOLD_AT}m+`;
    const range = `${mins(i)}–${mins(i + 1)}`;
    return i === 0 ? `${range}m` : range;
  };

  return (
    <figure className="sb-dist">
      <div
        className="sb-dist-plot"
        role="img"
        aria-label={
          ranked
            ? `Your time sits in the ${
                standings.percentile !== null
                  ? `top ${standings.percentile}%`
                  : 'field'
              } of ${standings.total} solvers`
            : `Solve times across ${standings.total} solvers`
        }
      >
        {bars.map((count, i) => (
          <div key={i} className={clsx('sb-dist-col', i === here && 'is-mine')}>
            <span className="sb-dist-count">
              {i === here ? (
                <>
                  <span className="sb-dist-you">You</span> {count}
                </>
              ) : (
                ''
              )}
            </span>
            {i === here && (
              <span className="sb-dist-guide" aria-hidden="true" />
            )}
            <span
              className="sb-dist-bar"
              style={{
                height: `${Math.max((count / peak) * 100, count > 0 ? 8 : 2)}%`,
              }}
            >
              {i !== here && count > 0 && (
                <span className="sb-dist-n">{count}</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="sb-dist-ticks">
        {bars.map((_, i) => (
          <span
            key={i}
            className={clsx('sb-dist-tick', i === here && 'is-mine')}
          >
            {tick(i)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
};

export const Summary = ({
  par,
  outcome,
  username,
  onComment,
  onPrevious,
  onReplay,
}: SummaryProps) => {
  const [note, setNote] = useState('');
  /** The button carries its own state, so no line of text has to appear for it. */
  const [status, setStatus] = useState<'idle' | 'sending' | 'error' | 'done'>(
    'idle'
  );
  const { result, standings, profile, fresh, ranked } = outcome;

  if (!result) return null;

  const done = status === 'done';

  const send = async () => {
    setStatus('sending');
    try {
      setStatus((await onComment(note)) ? 'done' : 'error');
    } catch (err) {
      console.error('comment failed', err);
      setStatus('error');
    }
  };

  const label = {
    idle: 'Comment my score',
    sending: 'Posting…',
    error: 'Post failed — try again',
    done: 'Posted',
  }[status];

  return (
    <section className="sb-result" aria-labelledby="sb-win-title">
      <div className="sb-result-head">
        <h2 id="sb-win-title" className="sb-win-title">
          Freed
        </h2>

        <p className="sb-win-time">{clock(result.adjustedMs)}</p>

        <dl className="sb-win-stats">
          <div>
            <dt>Moves</dt>
            <dd>
              {result.moves}
              <span className="sb-win-par"> / par {par}</span>
            </dd>
          </div>
          <div>
            <dt>Undos</dt>
            <dd>{result.undos}</dd>
          </div>
        </dl>

        <p className="sb-win-rank">
          {!ranked && username ? (
            <span>Untimed solve — not ranked</span>
          ) : standings.rank !== null ? (
            <span>
              <strong>
                #{standings.rank} of {standings.total}
              </strong>
              {standings.percentile !== null &&
                ` · Top ${standings.percentile}%`}
            </span>
          ) : (
            <span>
              {username
                ? `${standings.total} solved`
                : 'Log in to rank this solve'}
            </span>
          )}
          {profile && profile.streak > 0 && (
            <span className="sb-win-streak">{profile.streak}-day streak</span>
          )}
        </p>

        {!fresh && ranked && (
          <p className="sb-win-note">
            Replay — your first solve is the one that ranks.
          </p>
        )}
      </div>

      <Distribution
        standings={standings}
        adjustedMs={result.adjustedMs}
        ranked={ranked}
      />

      <div className="sb-result-foot">
        {username && !done && (
          <div className="sb-win-share">
            <input
              className="sb-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note… (optional)"
              maxLength={300}
              aria-label="Add a note to your comment"
            />
            <button
              className="sb-btn-brass"
              onClick={send}
              disabled={status === 'sending'}
            >
              {label}
            </button>
          </div>
        )}
        {done && <p className="sb-win-posted">Posted to the thread.</p>}

        <div className="sb-win-actions">
          <button className="sb-btn-brass" onClick={onPrevious} autoFocus>
            Previous dailies
          </button>
          <button className="sb-btn-ghost" onClick={onReplay}>
            <Icon name="restart" size={16} />
            Replay
          </button>
        </div>
      </div>
    </section>
  );
};
