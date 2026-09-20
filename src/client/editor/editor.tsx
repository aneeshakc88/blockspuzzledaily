import '../index.css';

import type { MouseEvent } from 'react';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { applyMove, cellsOf } from '../../shared/slideblock/engine';
import { analyze } from '../../shared/slideblock/metrics';
import { solve } from '../../shared/slideblock/solver';
import type {
  Axis,
  BoardSpec,
  Edge,
  Piece,
  State,
} from '../../shared/slideblock/types';

type EditorPiece = Piece & { pos: number };

type BankEntry = { id: number; name: string; spec: BoardSpec; state: State };

type Analysis = {
  result: ReturnType<typeof solve>;
  metrics: ReturnType<typeof analyze> | null;
  /** What was solved. Any edit makes a new spec/state object, so an identity
   *  mismatch means this verdict is stale. */
  forSpec: BoardSpec | null;
  forState: State;
};

const COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-lime-500',
  'bg-orange-500',
  'bg-teal-500',
];

type Dir = 'left' | 'right' | 'up' | 'down';

const ARROW_GLYPH: Record<Dir, string> = {
  left: '◀',
  right: '▶',
  up: '▲',
  down: '▼',
};

const CELL = 40;
const GAP = 2;
const STEP = CELL + GAP;
const REPLAY_MS = 600;

const Editor = () => {
  const [width, setWidth] = useState(6);
  const [height, setHeight] = useState(6);
  const [pieces, setPieces] = useState<EditorPiece[]>([]);
  const [exitPieceId, setExitPieceId] = useState<number | null>(null);
  const [exitEdge, setExitEdge] = useState<Edge | null>(null);
  const [nextId, setNextId] = useState(0);
  const [toolAxis, setToolAxis] = useState<Axis>('horizontal');
  const [toolLength, setToolLength] = useState(2);
  const [boardName, setBoardName] = useState('');
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [bank, setBank] = useState<BankEntry[]>([]);
  const [lastAnalysis, setAnalysis] = useState<Analysis | null>(null);
  const [solving, setSolving] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayState, setReplayState] = useState<State | null>(null);

  useEffect(() => {
    fetch('/api/bank')
      .then((res) => res.json())
      .then((entries: BankEntry[]) => setBank(entries))
      .catch(() => {});
  }, []);

  const loadFromBank = (entry: BankEntry) => {
    const byId = new Map(entry.state.placements.map((p) => [p.pieceId, p.pos]));
    const loadedPieces: EditorPiece[] = entry.spec.pieces.map((piece) => ({
      ...piece,
      pos: byId.get(piece.id) ?? 0,
    }));
    setWidth(entry.spec.width);
    setHeight(entry.spec.height);
    setPieces(loadedPieces);
    setExitPieceId(entry.spec.exitPieceId);
    setExitEdge(entry.spec.exitEdge);
    setNextId(Math.max(...entry.spec.pieces.map((p) => p.id)) + 1);
    setBoardName(entry.name);
    setSaveStatus('idle');
  };

  const spec: BoardSpec | null = useMemo(
    () =>
      exitPieceId === null || exitEdge === null
        ? null
        : {
            width,
            height,
            pieces: pieces.map(({ pos: _pos, ...piece }) => piece),
            exitPieceId,
            exitEdge,
          },
    [width, height, pieces, exitPieceId, exitEdge]
  );
  const state: State = useMemo(
    () => ({ placements: pieces.map((p) => ({ pieceId: p.id, pos: p.pos })) }),
    [pieces]
  );

  const grid = useMemo(() => {
    const cells = new Int32Array(width * height).fill(-1);
    for (const piece of pieces) {
      for (const cell of cellsOf(piece, piece.pos)) {
        cells[cell.y * width + cell.x] = piece.id;
      }
    }
    return cells;
  }, [width, height, pieces]);

  /** Dropped on any edit, so what is on screen is never a stale verdict. */
  const analysis =
    lastAnalysis &&
    lastAnalysis.forSpec === spec &&
    lastAnalysis.forState === state
      ? lastAnalysis
      : null;

  const runSolve = () => {
    if (!spec) return;
    setSolving(true);
    // Yielded to the browser first: solve() blocks, and the button should
    // read "Solving…" before it does.
    setTimeout(() => {
      const result = solve(spec, state);
      setAnalysis({
        result,
        metrics: result.solved ? analyze(spec, state, result) : null,
        forSpec: spec,
        forState: state,
      });
      setSolving(false);
    }, 0);
  };

  const result = analysis?.result ?? null;
  const metrics = analysis?.metrics ?? null;

  // Reveal is "on" only while there's a move left to show, so finishing the
  // last one flips the button back on its own — no setState-on-completion.
  const isRevealing = replaying && replayIndex < (result?.moves.length ?? 0);

  // Steps one move per tick against a snapshot state, leaving `pieces`/`state`
  // untouched so the solve verdict above doesn't clear mid-replay.
  useEffect(() => {
    if (!isRevealing || !result?.solved) return;
    const move = result.moves[replayIndex];
    if (!move) return;
    const timer = setTimeout(() => {
      setReplayState((prev) => applyMove(prev ?? state, move));
      setReplayIndex((i) => i + 1);
    }, REPLAY_MS);
    return () => clearTimeout(timer);
  }, [isRevealing, replayIndex, result, state]);

  const startReveal = () => {
    if (!result?.solved) return;
    setReplayState(state);
    setReplayIndex(0);
    setReplaying(true);
  };

  const stopReveal = () => {
    setReplaying(false);
    setReplayState(null);
    setReplayIndex(0);
  };

  const displayPieces = replayState
    ? pieces.map((piece) => {
        const placement = replayState.placements.find(
          (p) => p.pieceId === piece.id
        );
        return placement ? { ...piece, pos: placement.pos } : piece;
      })
    : pieces;

  const resize = (nextWidth: number, nextHeight: number) => {
    setWidth(nextWidth);
    setHeight(nextHeight);
    setPieces([]);
    setExitPieceId(null);
    setExitEdge(null);
  };

  const placeAt = (x: number, y: number) => {
    if (isRevealing) return;
    if (grid[y * width + x] !== -1) return;

    const start = toolAxis === 'horizontal' ? x : y;
    const track = toolAxis === 'horizontal' ? y : x;
    const span = toolAxis === 'horizontal' ? width : height;
    if (start + toolLength > span) return;

    for (let i = 0; i < toolLength; i++) {
      const cx = toolAxis === 'horizontal' ? x + i : x;
      const cy = toolAxis === 'horizontal' ? y : y + i;
      if (grid[cy * width + cx] !== -1) return;
    }

    setPieces((prev) => [
      ...prev,
      { id: nextId, axis: toolAxis, length: toolLength, track, pos: start },
    ]);
    setNextId((n) => n + 1);
  };

  const removePiece = (id: number) => {
    if (isRevealing) return;
    setPieces((prev) => prev.filter((p) => p.id !== id));
    if (exitPieceId === id) {
      setExitPieceId(null);
      setExitEdge(null);
    }
  };

  const saveToBank = async () => {
    if (!spec || !result?.solved) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: boardName, spec, state }),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    }
  };

  const setExit = (pieceId: number, edge: Edge, e: MouseEvent) => {
    if (isRevealing) return;
    e.stopPropagation();
    if (exitPieceId === pieceId && exitEdge === edge) {
      setExitPieceId(null);
      setExitEdge(null);
    } else {
      setExitPieceId(pieceId);
      setExitEdge(edge);
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-gray-950 p-6 text-gray-100">
      <h1 className="text-xl font-bold">Slideblock Editor</h1>

      {bank.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-400">
            Stored boards ({bank.length})
          </h2>
          <div className="flex flex-wrap gap-3">
            {bank.map((entry) => (
              <button
                key={entry.id}
                onClick={() => loadFromBank(entry)}
                title={`Load ${entry.name}`}
                className="flex flex-col items-center gap-1 rounded border border-gray-700 bg-gray-900 p-2 hover:border-gray-500"
              >
                <div
                  className="relative"
                  style={{
                    width: entry.spec.width * 6,
                    height: entry.spec.height * 6,
                  }}
                >
                  {entry.spec.pieces.map((piece) => {
                    const placement = entry.state.placements.find(
                      (p) => p.pieceId === piece.id
                    );
                    const pos = placement?.pos ?? 0;
                    const isHorizontal = piece.axis === 'horizontal';
                    return (
                      <div
                        key={piece.id}
                        className={`absolute rounded-sm ${
                          piece.id === entry.spec.exitPieceId
                            ? 'bg-red-600'
                            : COLORS[piece.id % COLORS.length]
                        }`}
                        style={{
                          left: (isHorizontal ? pos : piece.track) * 6,
                          top: (isHorizontal ? piece.track : pos) * 6,
                          width: (isHorizontal ? piece.length : 1) * 6 - 1,
                          height: (isHorizontal ? 1 : piece.length) * 6 - 1,
                        }}
                      />
                    );
                  })}
                </div>
                <span className="text-xs text-gray-300">{entry.name}</span>
                <span className="text-[10px] text-gray-500">
                  {entry.spec.pieces.length} pieces
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Width
          <input
            type="number"
            min={2}
            max={8}
            value={width}
            onChange={(e) => resize(Number(e.target.value), height)}
            className="w-14 rounded bg-gray-800 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          Height
          <input
            type="number"
            min={2}
            max={8}
            value={height}
            onChange={(e) => resize(width, Number(e.target.value))}
            className="w-14 rounded bg-gray-800 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          Axis
          <select
            value={toolAxis}
            onChange={(e) => setToolAxis(e.target.value as Axis)}
            className="rounded bg-gray-800 px-2 py-1"
          >
            <option value="horizontal">horizontal</option>
            <option value="vertical">vertical</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Length
          <input
            type="number"
            min={1}
            max={4}
            value={toolLength}
            onChange={(e) => setToolLength(Number(e.target.value))}
            className="w-14 rounded bg-gray-800 px-2 py-1"
          />
        </label>
        <button
          onClick={() => resize(width, height)}
          className="rounded bg-gray-700 px-3 py-1 hover:bg-gray-600"
        >
          Clear board
        </button>
      </div>

      <p className="text-sm text-gray-400">
        Click empty cells to place a piece with the current axis/length. Click
        the ✕ in the middle of a piece to remove it, an arrow at either end to
        make it the exit.
      </p>

      <div
        className="relative"
        style={{ width: width * STEP - GAP, height: height * STEP - GAP }}
      >
        {Array.from({ length: height }).map((_, y) =>
          Array.from({ length: width }).map((_, x) => (
            <div
              key={`${x}-${y}`}
              onClick={() => placeAt(x, y)}
              className="absolute cursor-pointer rounded border border-gray-700 bg-gray-900 hover:bg-gray-800"
              style={{
                left: x * STEP,
                top: y * STEP,
                width: CELL,
                height: CELL,
              }}
            />
          ))
        )}

        {displayPieces.map((piece) => {
          const isExit = piece.id === exitPieceId;
          const isHorizontal = piece.axis === 'horizontal';
          const size = piece.length * STEP - GAP;
          const startEdge: Edge = isHorizontal ? 'left' : 'top';
          const endEdge: Edge = isHorizontal ? 'right' : 'bottom';
          const startDir: Dir = isHorizontal ? 'left' : 'up';
          const endDir: Dir = isHorizontal ? 'right' : 'down';
          const isMoving =
            isRevealing && result?.moves[replayIndex]?.pieceId === piece.id;

          return (
            <div
              key={piece.id}
              className={`absolute flex items-center justify-between rounded-md border transition-[left,top] duration-500 ease-out ${
                isMoving ? 'border-2 border-white' : 'border-black/30'
              } ${isHorizontal ? 'flex-row' : 'flex-col'} ${
                isExit ? 'bg-red-600' : COLORS[piece.id % COLORS.length]
              }`}
              style={{
                left: (isHorizontal ? piece.pos : piece.track) * STEP,
                top: (isHorizontal ? piece.track : piece.pos) * STEP,
                width: isHorizontal ? size : CELL,
                height: isHorizontal ? CELL : size,
              }}
            >
              <button
                onClick={(e) => setExit(piece.id, startEdge, e)}
                title={`Set piece #${piece.id} to exit ${startEdge}`}
                className={`flex flex-none items-center justify-center text-sm ${
                  isHorizontal ? 'h-full w-4' : 'h-4 w-full'
                } ${
                  isExit && exitEdge === startEdge
                    ? 'font-bold text-white'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {ARROW_GLYPH[startDir]}
              </button>
              <button
                onClick={() => removePiece(piece.id)}
                title={`Remove piece #${piece.id}`}
                className="flex flex-1 items-center justify-center text-sm text-white/30 hover:text-white"
              >
                ✕
              </button>
              <button
                onClick={(e) => setExit(piece.id, endEdge, e)}
                title={`Set piece #${piece.id} to exit ${endEdge}`}
                className={`flex flex-none items-center justify-center text-sm ${
                  isHorizontal ? 'h-full w-4' : 'h-4 w-full'
                } ${
                  isExit && exitEdge === endEdge
                    ? 'font-bold text-white'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {ARROW_GLYPH[endDir]}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-gray-400">
        {exitPieceId === null ? (
          'Click an arrow on a piece to make it the exit, pointing the way out.'
        ) : (
          <>
            Exit: piece{' '}
            <span className="font-semibold text-red-400">#{exitPieceId}</span>{' '}
            {exitEdge} — click its arrow again to unset.
          </>
        )}
      </p>

      <div className="flex flex-col gap-3 rounded border border-gray-700 bg-gray-900 p-4 text-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={runSolve}
            disabled={!spec || solving}
            className="rounded bg-blue-700 px-4 py-1.5 font-semibold hover:bg-blue-600 disabled:opacity-40"
          >
            {solving ? 'Solving…' : 'Solve'}
          </button>
          {!spec && (
            <span className="text-gray-400">
              Pick an exit piece first — arrange the board, then solve.
            </span>
          )}
          {spec && !result && !solving && (
            <span className="text-gray-400">
              Arrange the board, then solve. Any edit clears the verdict.
            </span>
          )}
          {result?.solved && (
            <button
              onClick={isRevealing ? stopReveal : startReveal}
              className="rounded bg-purple-700 px-4 py-1.5 font-semibold hover:bg-purple-600"
            >
              {isRevealing ? 'Stop' : 'Reveal solution'}
            </button>
          )}
          {isRevealing && (
            <span className="text-gray-400">
              Move {replayIndex + 1} / {result?.moves.length}
            </span>
          )}
        </div>

        {result && (
          <div className="flex flex-col gap-1">
            <p>
              <span className="font-semibold">Solvable:</span>{' '}
              {result.solved ? 'yes' : 'no'}
            </p>
            {result.solved && metrics && (
              <>
                <p>
                  <span className="font-semibold">Moves:</span> {metrics.moves}
                </p>
                <p>
                  <span className="font-semibold">Chokepoint depth:</span>{' '}
                  {metrics.chokepointDepth}
                </p>
                <p>
                  <span className="font-semibold">False-path ratio:</span>{' '}
                  {metrics.falsePathRatio.toFixed(1)}
                </p>
                <p>
                  <span className="font-semibold">Near-trap states:</span>{' '}
                  {metrics.nearTrapCount}
                </p>
              </>
            )}
            <p>
              <span className="font-semibold">States explored:</span>{' '}
              {result.effort.expanded}
            </p>
            {result.solved && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Board name"
                  value={boardName}
                  onChange={(e) => {
                    setBoardName(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="rounded bg-gray-800 px-2 py-1"
                />
                <button
                  onClick={saveToBank}
                  disabled={saveStatus === 'saving'}
                  className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600 disabled:opacity-50"
                >
                  Save to bank
                </button>
                {saveStatus === 'saved' && (
                  <span className="text-emerald-400">Saved.</span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-red-400">Save failed.</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {spec && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer select-none">Board JSON</summary>
          <pre className="mt-2 overflow-auto rounded bg-gray-900 p-3">
            {JSON.stringify({ spec, state }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Editor />
  </StrictMode>
);
