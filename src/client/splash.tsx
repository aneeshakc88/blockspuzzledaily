import '@fontsource/holtwood-one-sc/latin-400.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-800.css';
import './splash.css';

import { requestExpandedMode } from '@devvit/web/client';
import type { inferRouterOutputs } from '@trpc/server';
import type { CSSProperties } from 'react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { clock } from './slideblock/storage';
import { trpc } from './trpc';
import type { AppRouter } from '../server/trpc';
import clsx from 'clsx';

type Leaderboard = inferRouterOutputs<AppRouter>['daily']['leaderboard'];
type Solver = Leaderboard['top'][number];

/** Requests every solver on the board, not a top-N cut — matches the server's cap. */
const ALL_SOLVERS = 5000;

/** Enough rows to open the board on instantly; matches the server's AVATAR_ROWS,
 *  past which every row comes back avatar-less anyway. */
const HEAD_ROWS = 25;

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: 'dark' | 'exit';
  track?: string;
};

/**
 * A real 5x4 position, not a decorative one: the two blockers drop out of the
 * red block's lane, then it leaves through the notch. Loops as one solve.
 */
const BLOCKS: Block[] = [
  { x: 0, y: 0, w: 2, h: 1 },
  { x: 2, y: 0, w: 1, h: 2, tone: 'dark', track: 'sp-clear-a' },
  { x: 3, y: 0, w: 1, h: 2, track: 'sp-clear-b' },
  { x: 0, y: 1, w: 2, h: 1, tone: 'exit', track: 'sp-escape' },
  { x: 0, y: 2, w: 1, h: 2, tone: 'dark' },
  { x: 1, y: 2, w: 1, h: 2 },
  { x: 4, y: 2, w: 1, h: 2, tone: 'dark' },
];

const Tray = () => (
  <div className="sp-tray" aria-hidden="true">
    <div className="sp-floor">
      <span className="sp-exit" />
      {BLOCKS.map((block, i) => (
        <div
          key={i}
          className={[
            'sp-block',
            block.tone === 'dark' ? 'is-dark' : '',
            block.tone === 'exit' ? 'is-exit' : '',
            block.track ? 'is-anim' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            {
              '--x': block.x,
              '--y': block.y,
              '--w': block.w,
              '--h': block.h,
              '--grain': block.h > block.w ? '0deg' : '90deg',
              ...(block.track ? { '--track': block.track } : {}),
            } as CSSProperties
          }
        />
      ))}
    </div>
  </div>
);

/** Snoovatar when Reddit has one, the initial on a disc when it does not. */
const Avatar = ({
  solver,
}: {
  solver: { username: string; avatar: string | null };
}) => {
  const [broken, setBroken] = useState(false);

  return (
    <span className="sp-avatar" title={`u/${solver.username}`}>
      {solver.avatar && !broken ? (
        <img
          src={solver.avatar}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="sp-avatar-letter">
          {solver.username.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
};

type Snoo = { username: string; avatar: string; you: boolean };

/**
 * Huddle slots, as percentages of the pile box: x/width across it, y up from
 * its floor. Front-and-biggest sits lowest with the highest z, so the pile
 * reads as a crowd peeking past the wordmark rather than a row of stickers.
 */
const PILE_SLOTS = [
  { x: 24, y: 0, w: 54, r: 0, z: 6 },
  { x: -4, y: 7, w: 45, r: -9, z: 5 },
  { x: 57, y: 5, w: 43, r: 9, z: 5 },
  { x: 6, y: 33, w: 43, r: -6, z: 3 },
  { x: 45, y: 40, w: 41, r: 7, z: 2 },
];

/**
 * The five fastest solvers that actually have a snoovatar - avatar-less ranks
 * are stepped over, not left as a hole. A board nobody has solved yet shows
 * the viewer alone.
 */
function pileSnoos(board: Leaderboard | null): Snoo[] {
  if (!board) return [];

  const faces: Snoo[] = [];
  for (const solver of board.top) {
    if (!solver.avatar) continue;
    faces.push({
      username: solver.username,
      avatar: solver.avatar,
      you: solver.username === board.username,
    });
    if (faces.length === PILE_SLOTS.length) break;
  }

  if (faces.length === 0 && board.username && board.myAvatar)
    faces.push({ username: board.username, avatar: board.myAvatar, you: true });

  return faces;
}

/** A snoovatar that failed to load leaves its slot empty rather than a frame. */
const PileSnoo = ({
  snoo,
  slot,
  delay,
}: {
  snoo: Snoo;
  slot: (typeof PILE_SLOTS)[number];
  delay: number;
}) => {
  const [broken, setBroken] = useState(false);
  if (broken) return null;

  return (
    <img
      className={clsx('sp-pile-snoo', snoo.you && 'is-you')}
      src={snoo.avatar}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      style={
        {
          '--x': `${slot.x}%`,
          '--y': `${slot.y}%`,
          '--w': `${slot.w}%`,
          '--r': `${slot.r}deg`,
          '--z': slot.z,
          '--delay': `${delay}s`,
        } as CSSProperties
      }
    />
  );
};

/** Decorative: hidden from the tree so the card still reads as "SlideBlock". */
const SnooPile = ({ snoos }: { snoos: Snoo[] }) =>
  snoos.length === 0 ? null : (
    <span className="sp-pile" aria-hidden="true">
      {snoos.map((snoo, i) => (
        <PileSnoo
          key={snoo.username}
          snoo={snoo}
          slot={PILE_SLOTS[i]!}
          delay={i * 0.32}
        />
      ))}
    </span>
  );

const Podium = ({ top, you }: { top: Solver[]; you: string | null }) => {
  // Second on the left, winner in the middle, third on the right.
  const steps: [number, Solver | undefined][] = [
    [2, top[1]],
    [1, top[0]],
    [3, top[2]],
  ];

  return (
    <ol className="sp-podium">
      {steps.map(([place, solver]) =>
        solver ? (
          <li
            key={place}
            className={clsx(
              'sp-step',
              `is-${place}`,
              solver.username === you && 'is-you'
            )}
          >
            <Avatar solver={solver} />
            <span className="sp-step-name">u/{solver.username}</span>
            <span className="sp-step-time">{clock(solver.adjustedMs)}</span>
            <span className="sp-step-block">{place}</span>
          </li>
        ) : (
          <li key={place} className={`sp-step is-${place} is-empty`}>
            <span className="sp-step-block">{place}</span>
          </li>
        )
      )}
    </ol>
  );
};

type Tab = 'scores' | 'stats';

/** Where the player themself landed, pinned above the list they may not be in. */
const YourRank = ({ board }: { board: Leaderboard }) => {
  if (!board.username) return null;
  const me: Solver = {
    rank: board.myRank ?? 0,
    username: board.username,
    adjustedMs: board.myResult?.adjustedMs ?? 0,
    avatar: board.myAvatar,
  };

  return (
    <div className="sp-you">
      <span className="sp-you-label">Your rank</span>
      <Avatar solver={me} />
      <span className="sp-you-place">
        {board.myRank !== null ? `#${board.myRank}` : '—'}
      </span>
      <span className="sp-you-time">
        {board.myResult ? clock(board.myResult.adjustedMs) : '—'}
      </span>
    </div>
  );
};

const ScoresTab = ({ board }: { board: Leaderboard }) => {
  if (board.top.length === 0)
    return (
      <p className="sp-sheet-note">
        Nobody has freed the red block yet. Be the first.
      </p>
    );

  return (
    <>
      <YourRank board={board} />
      <Podium top={board.top} you={board.username} />

      {board.top.length > 3 && (
        <ol className="sp-ranks">
          {board.top.slice(3).map((solver) => (
            <li
              key={solver.username}
              className={solver.username === board.username ? 'is-you' : ''}
            >
              <span className="sp-rank-no">{solver.rank}</span>
              <Avatar solver={solver} />
              <span className="sp-rank-name">u/{solver.username}</span>
              <span className="sp-rank-time">{clock(solver.adjustedMs)}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="sp-sheet-note">
        {board.total === 1 ? '1 solve' : `${board.total} solves`} today
        {board.myPercentile !== null
          ? ` · you are top ${board.myPercentile}%`
          : ''}
      </p>
    </>
  );
};

const Stat = ({
  label,
  value,
  hi,
}: {
  label: string;
  value: string;
  hi?: boolean;
}) => (
  <div className={clsx('sp-stat', hi && 'is-hi')}>
    <span className="sp-stat-label">{label}</span>
    <span className="sp-stat-value">{value}</span>
  </div>
);

const StatsTab = ({ board }: { board: Leaderboard }) => {
  const { username, profile, myResult } = board;

  if (!username)
    return <p className="sp-sheet-note">Log in to keep a streak and a rank.</p>;

  const me: Solver = {
    rank: 0,
    username,
    adjustedMs: 0,
    avatar: board.myAvatar,
  };

  return (
    <div className="sp-stats">
      <div className="sp-stats-who">
        <Avatar solver={me} />
        <p className="sp-stats-name">u/{username}</p>
        <p className="sp-stats-sub">
          {profile && profile.solved > 0
            ? `${profile.solved} board${profile.solved === 1 ? '' : 's'} freed`
            : 'No boards freed yet.'}
        </p>
      </div>

      <div className="sp-stat-grid">
        <Stat label="Streak" value={String(profile?.streak ?? 0)} hi />
        <Stat label="Longest" value={String(profile?.longest ?? 0)} />
      </div>
      <Stat label="Boards freed" value={String(profile?.solved ?? 0)} />

      <p className="sp-stats-head">Today&apos;s board</p>
      {myResult ? (
        <div className="sp-stat-grid is-three">
          <Stat label="Time" value={clock(myResult.adjustedMs)} hi />
          <Stat label="Moves" value={`${myResult.moves} / ${board.par}`} />
          <Stat
            label="Rank"
            value={board.myRank !== null ? `#${board.myRank}` : '—'}
          />
        </div>
      ) : (
        <p className="sp-sheet-note">Not solved yet.</p>
      )}
    </div>
  );
};

const Leaders = ({
  board,
  failed,
  onRetry,
  onClose,
}: {
  board: Leaderboard | null;
  failed: boolean;
  onRetry: () => void;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState<Tab>('scores');

  const tabBtn = (id: Tab, label: string) => (
    <button
      className={clsx('sp-tab', tab === id && 'is-on')}
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
    >
      {label}
    </button>
  );

  return (
    <main className="sp sp-full" aria-label="Today's leaderboard">
      {/* Same spot the trophy sits on the splash, so the icon doesn't jump
          when this screen replaces it. */}
      <button
        className="sp-icon-btn sp-trophy"
        onClick={onClose}
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="sp-sheet-head">
        <h2>Leaderboard</h2>
      </div>

      {failed ? (
        <p className="sp-sheet-note">
          Could not reach the scores.{' '}
          <button className="sp-link" onClick={onRetry}>
            Try again
          </button>
        </p>
      ) : board === null ? (
        <p className="sp-sheet-note">Reading the board…</p>
      ) : (
        <>
          <div className="sp-tabs">
            {tabBtn('scores', 'Scores')}
            {tabBtn('stats', 'Stats')}
          </div>
          <div className="sp-sheet-body">
            {tab === 'scores' ? (
              <ScoresTab board={board} />
            ) : (
              <StatsTab board={board} />
            )}
          </div>
        </>
      )}
    </main>
  );
};

/** Sample scores for the standalone preview server; `?demo` only. */
async function demoBoard(): Promise<Leaderboard | null> {
  if (!new URLSearchParams(location.search).has('demo')) return null;
  return (await import('./splash.demo')).DEMO;
}

export const Splash = () => {
  const [head, setHead] = useState<Leaderboard | null>(null);
  const [full, setFull] = useState<Leaderboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  // The card paints without this; the strip fills in when it lands.
  useEffect(() => {
    trpc.daily.leaderboard
      .query({ limit: HEAD_ROWS })
      .then(setHead)
      .catch(() => void demoBoard().then(setHead));
  }, []);

  const loadLeaders = () => {
    setFailed(false);
    trpc.daily.leaderboard
      .query({ limit: ALL_SOLVERS })
      .then(setFull)
      .catch(async (err) => {
        console.error('leaderboard failed', err);
        const demo = await demoBoard();
        if (demo) return setFull(demo);
        if (head) return setFull(head);
        setFailed(true);
      });
  };

  const openLeaders = () => {
    setOpen(true);
    if (!full) loadLeaders();
  };

  // The board takes over the whole splash rather than sitting in a scrim: the
  // feed card is short, and a modal inside it left the ranks in a slot.
  if (open)
    return (
      <Leaders
        board={full}
        failed={failed}
        onRetry={loadLeaders}
        onClose={() => setOpen(false)}
      />
    );

  return (
    <main className="sp">
      <button
        className="sp-icon-btn sp-trophy"
        onClick={openLeaders}
        aria-label="Today's leaderboard"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v1a4 4 0 0 0 3 3.9M17 6h3v1a4 4 0 0 1-3 3.9" />
          <path d="M12 14v3M8.5 20h7l-.7-3h-5.6l-.7 3Z" />
        </svg>
      </button>

      <SnooPile snoos={pileSnoos(head)} />

      <div className="sp-card">
        <Tray />

        <div className="sp-copy">
          <p className="sp-kicker">Today&apos;s board</p>
          <h1 className="sp-wordmark">
            Slide<span>Block</span>
          </h1>
          <p className="sp-tag">
            Slide the blocks out of the way. Free the red one in as few moves as
            you can.
          </p>

          <button
            className="sp-cta"
            onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
          >
            Play
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
