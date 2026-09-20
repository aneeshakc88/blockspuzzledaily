import { useEffect, useState } from 'react';
import { BANK } from '../../shared/slideblock/bank';
import { trpc } from '../trpc';
import { Icon } from './icons';
import clsx from 'clsx';

type Entry = { boardId: number; date: string; solved: boolean };

type BoardSheetProps = {
  current: number;
  onPick: (boardId: number) => void;
  onClose: () => void;
};

const MiniBoard = ({ boardId }: { boardId: number }) => {
  const entry = BANK.find((e) => e.id === boardId);
  if (!entry) return <span className="sb-mini-board" />;

  const { width, height, pieces, exitPieceId } = entry.spec;
  return (
    <span
      className="sb-mini-board"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {pieces.map((piece) => {
        const pos =
          entry.state.placements.find((p) => p.pieceId === piece.id)?.pos ?? 0;
        const horizontal = piece.axis === 'horizontal';
        const x = horizontal ? pos : piece.track;
        const y = horizontal ? piece.track : pos;
        return (
          <span
            key={piece.id}
            className={clsx(
              'sb-mini-piece',
              piece.id === exitPieceId && 'is-exit'
            )}
            style={{
              left: `calc(${(x / width) * 100}% + 1px)`,
              top: `calc(${(y / height) * 100}% + 1px)`,
              width: `calc(${((horizontal ? piece.length : 1) / width) * 100}% - 2px)`,
              height: `calc(${((horizontal ? 1 : piece.length) / height) * 100}% - 2px)`,
            }}
          />
        );
      })}
    </span>
  );
};

export const BoardSheet = ({ current, onPick, onClose }: BoardSheetProps) => {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    trpc.daily.previous
      .query()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  const solvedCount = entries?.filter((e) => e.solved).length ?? 0;

  return (
    <div className="sb-sheet-backdrop" onClick={onClose}>
      <section
        className="sb-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sb-sheet-head">
          <div>
            <h2 id="sb-sheet-title" className="sb-sheet-title">
              Previous dailies
            </h2>
            <p className="sb-sheet-sub">
              {entries === null
                ? 'Loading…'
                : entries.length === 0
                  ? 'No earlier boards yet.'
                  : `${solvedCount} of ${entries.length} freed · each keeps its own leaderboard`}
            </p>
          </div>
          <button className="sb-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <div className="sb-sheet-grid">
          {(entries ?? []).map((entry) => (
            <button
              key={entry.boardId}
              className={clsx(
                'sb-mini',
                entry.boardId === current && 'is-current'
              )}
              onClick={() => onPick(entry.boardId)}
              aria-label={`${entry.date}, ${entry.solved ? 'freed' : 'unplayed'}`}
            >
              <MiniBoard boardId={entry.boardId} />
              <span className="sb-mini-name">{entry.date.slice(5)}</span>
              <span className={clsx('sb-mini-best', entry.solved && 'is-done')}>
                {entry.solved ? 'Freed' : 'Unplayed'}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
