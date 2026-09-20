import '@fontsource/holtwood-one-sc/latin-400.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-800.css';
import './slideblock.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../server/trpc';
import { trpc } from '../trpc';
import { applyMove, isSolved } from '../../shared/slideblock/engine';
import type { Move, State } from '../../shared/slideblock/types';
import { Board } from './Board';
import { BoardSheet } from './BoardSheet';
import { Icon } from './icons';
import { knock, marimba, unlock } from './sound';
import { loadMuted, storeMuted, clock } from './storage';
import { Summary, type Outcome } from './Summary';
import { woodTexture, type StyleVars } from './wood';
import clsx from 'clsx';

type Outputs = inferRouterOutputs<AppRouter>;
type Payload = Outputs['daily']['get'];

export const PlayScreen = () => {
  const [muted, setMuted] = useState(loadMuted);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  const [history, setHistory] = useState<State[]>([]);
  const [path, setPath] = useState<Move[]>([]);
  const [undos, setUndos] = useState(0);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  /** The in-flight "I have started" ping. The time itself is the server's. */
  const begun = useRef<Promise<unknown> | null>(null);

  useEffect(() => storeMuted(muted), [muted]);

  const textures: StyleVars = useMemo(
    () => ({
      '--tex-walnut': `url(${woodTexture('walnut', 6, 6, false, 7)})`,
      '--tex-floor': `url(${woodTexture('floor', 6, 6, false, 13)})`,
      '--tex-maple': `url(${woodTexture('maple', 6, 3, false, 21)})`,
    }),
    []
  );

  /** A different board is a different attempt: clock and undos start over. */
  const install = useCallback((data: Payload) => {
    setPayload(data);
    setHistory([data.state as State]);
    setPath([]);
    setUndos(0);
    setStartedAt(null);
    setElapsed(0);
    setOutcome(null);
    setSheetOpen(false);
    begun.current = null;
  }, []);

  useEffect(() => {
    trpc.daily.get
      .query()
      .then(install)
      .catch(() => setFailed(true));
  }, [install]);

  const state = history[history.length - 1];
  const solved = payload && state ? isSolved(payload.spec, state) : false;

  useEffect(() => {
    if (startedAt === null || solved) return;
    const id = window.setInterval(
      () => setElapsed(Date.now() - startedAt),
      250
    );
    return () => window.clearInterval(id);
  }, [startedAt, solved]);

  const openBoard = (boardId: number) => {
    trpc.daily.board
      .query({ boardId })
      .then(install)
      .catch(() => setSheetOpen(false));
  };

  /** Starts the server's clock. Sending it twice is harmless — the server keeps
   *  the first start and ignores the rest. */
  const beginIfNeeded = (boardId: number) => {
    begun.current ??= trpc.daily.begin
      .mutate({ boardId })
      .catch(() => null as unknown);
  };

  const finish = async (moves: Move[], timeMs: number) => {
    if (!payload) return;
    const local: Outcome = {
      fresh: false,
      ranked: false,
      result: {
        timeMs,
        adjustedMs: timeMs,
        moves: moves.length,
        hints: 0,
        undos,
        at: Date.now(),
      },
      standings: payload.standings,
      profile: null,
    };
    try {
      // The answer must not overtake the start, or the server has nothing to
      // measure from. A dropped ping gets one more try before it costs a rank.
      if ((await begun.current) === null)
        await trpc.daily.begin.mutate({ boardId: payload.boardId });

      const server = await trpc.daily.submit.mutate({
        boardId: payload.boardId,
        moves,
        undos,
      });
      // An untimed solve still shows the player their own clock; it just says
      // so, and carries no rank.
      setOutcome(server.result ? server : { ...server, result: local.result });
    } catch {
      // Logged out, or the server would not take it: they still get their time,
      // the field they landed in, and no rank.
      setOutcome(local);
    }
  };

  const onMove = (move: Move) => {
    if (!payload || !state || solved) return;
    const now = Date.now();
    if (startedAt === null) setStartedAt(now);
    beginIfNeeded(payload.boardId);

    const next = applyMove(state, move);
    const nextPath = [...path, move];
    setHistory([...history, next]);
    setPath(nextPath);
    if (!muted) knock(Math.min(1, 0.55 + move.dist * 0.15));
    if ('vibrate' in navigator) navigator.vibrate(8);

    if (!isSolved(payload.spec, next)) return;
    if (!muted) window.setTimeout(marimba, 260);
    void finish(nextPath, now - (startedAt ?? now));
  };

  const undo = () => {
    if (history.length <= 1) return;
    setHistory(history.slice(0, -1));
    setPath(path.slice(0, -1));
    setUndos((u) => u + 1);
  };

  /** Board back to the start. The clock and undos deliberately stay put. */
  const restart = () => {
    if (!payload) return;
    setHistory([payload.state as State]);
    setPath([]);
  };

  /** A replay is a fresh attempt: clock and undos start over. */
  const replay = () => {
    if (!payload) return;
    setHistory([payload.state as State]);
    setPath([]);
    setUndos(0);
    setStartedAt(null);
    setElapsed(0);
    setOutcome(null);
  };

  if (failed)
    return (
      <main className="sb-root sb-centred" style={textures}>
        <p className="sb-prompt">
          Could not load today&apos;s board. Try reopening the post.
        </p>
      </main>
    );

  if (!payload || !state)
    return (
      <main className="sb-root sb-centred" style={textures}>
        <p className="sb-prompt">Setting the blocks…</p>
      </main>
    );

  const moves = history.length - 1;
  const shownMs = elapsed;
  const prompt = solved
    ? ''
    : moves === 0
      ? 'Drag blocks along their grooves. Free the red block.'
      : '';

  return (
    <main
      className={clsx('sb-root', outcome && 'is-result')}
      style={textures}
      onPointerDownCapture={unlock}
    >
      <div className="sb-panel">
        <header className="sb-header">
          <h1 className="sb-wordmark">
            Slide<span>Block</span>
          </h1>
          <div className="sb-header-actions">
            <button
              className="sb-icon-btn"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            >
              <Icon name={muted ? 'soundOff' : 'soundOn'} />
            </button>
            <button
              className="sb-icon-btn"
              onClick={() => setSheetOpen(true)}
              aria-label="Previous dailies"
            >
              <Icon name="boards" />
            </button>
          </div>
        </header>

        {!outcome && (
          <dl className="sb-stats">
            <div className="sb-stat">
              <dt>Time</dt>
              <dd>{clock(shownMs)}</dd>
            </div>
            <div className="sb-stat">
              <dt>Moves</dt>
              <dd>{moves}</dd>
            </div>
            <div className="sb-stat">
              <dt>Par</dt>
              <dd>{payload.par}</dd>
            </div>
          </dl>
        )}
      </div>

      {outcome ? (
        <Summary
          par={payload.par}
          outcome={outcome}
          username={payload.username}
          onComment={(note) =>
            trpc.daily.comment
              .mutate({ boardId: payload.boardId, note })
              .then((r) => r.posted)
          }
          onPrevious={() => setSheetOpen(true)}
          onReplay={replay}
        />
      ) : (
        <>
          <Board
            key={payload.boardId}
            seed={payload.boardId}
            spec={payload.spec}
            state={state}
            solved={solved}
            onMove={onMove}
          />

          <div className="sb-controls">
            <p className="sb-prompt" aria-live="polite">
              {prompt}
            </p>

            <div className="sb-tools">
              <button
                className="sb-tool"
                onClick={undo}
                disabled={moves === 0 || solved}
                aria-label="Undo last move"
              >
                <Icon name="undo" />
                <span className="sb-tool-label">Undo</span>
              </button>
              <button
                className="sb-tool"
                onClick={restart}
                disabled={moves === 0 || solved}
                aria-label="Restart board, clock keeps running"
              >
                <Icon name="restart" />
                <span className="sb-tool-label">Restart</span>
              </button>
            </div>
          </div>
        </>
      )}

      {sheetOpen && (
        <BoardSheet
          current={payload.boardId}
          onPick={openBoard}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
  );
};
