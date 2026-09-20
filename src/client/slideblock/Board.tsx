import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { legalMoves, pieceOf } from '../../shared/slideblock/engine';
import type {
  BoardSpec,
  Edge,
  Move,
  Piece,
  State,
} from '../../shared/slideblock/types';
import { Icon } from './icons';
import { lightWood, woodTexture, type StyleVars } from './wood';

/** Frame rail thickness, in cells. */
const FRAME = 0.5;
const MAX_CELL = 92;
const EDGE_ROTATION: Record<Edge, number> = {
  right: 0,
  bottom: 90,
  left: 180,
  top: 270,
};

type Drag = {
  pieceId: number;
  pointerId: number;
  origin: number;
  startPos: number;
  min: number;
  max: number;
  pos: number;
};

type BoardProps = {
  seed: number;
  spec: BoardSpec;
  state: State;
  solved: boolean;
  onMove: (move: Move) => void;
};

function slideRange(
  spec: BoardSpec,
  state: State,
  pieceId: number,
  pos: number
) {
  let back = 0;
  let forward = 0;
  for (const move of legalMoves(spec, state)) {
    if (move.pieceId !== pieceId) continue;
    if (move.dir === 1) forward = Math.max(forward, move.dist);
    else back = Math.max(back, move.dist);
  }
  return { min: pos - back, max: pos + forward };
}

/** Past a stop the block gives a hair, like wood pressed against wood, then refuses. */
function resist(over: number): number {
  return 0.16 * (1 - Math.exp(-over * 2.5));
}

function useCellSize(cols: number, rows: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (width: number, height: number) => {
      // Clamp to the window: a tray wider than the page widens the column that measures it,
      // which would feed the next measurement an ever-larger box.
      const room = Math.min(width, document.documentElement.clientWidth - 32);
      setCell(
        Math.floor(
          Math.min(
            room / (cols + FRAME * 2),
            height / (rows + FRAME * 2),
            MAX_CELL
          )
        )
      );
    };
    // Measure up front: a throttled ResizeObserver would otherwise leave the tray unbuilt.
    const box = el.getBoundingClientRect();
    measure(box.width, box.height);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      measure(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cols, rows]);
  return { ref, cell };
}

export const Board = ({ seed, spec, state, solved, onMove }: BoardProps) => {
  const { ref, cell } = useCellSize(spec.width, spec.height);
  const [drag, setDrag] = useState<Drag | null>(null);

  const textures = useMemo(
    () =>
      new Map(
        spec.pieces.map((piece): [number, string] => [
          piece.id,
          woodTexture(
            piece.id === spec.exitPieceId
              ? 'padauk'
              : lightWood(seed + piece.id),
            piece.length,
            1,
            piece.axis === 'vertical',
            seed * 31 + piece.id
          ),
        ])
      ),
    [spec, seed]
  );

  const positions = new Map(
    state.placements.map((p): [number, number] => [p.pieceId, p.pos])
  );

  const startDrag = (
    e: PointerEvent<HTMLDivElement>,
    piece: Piece,
    pos: number
  ) => {
    if (solved || drag || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { min, max } = slideRange(spec, state, piece.id, pos);
    setDrag({
      pieceId: piece.id,
      pointerId: e.pointerId,
      origin: piece.axis === 'horizontal' ? e.clientX : e.clientY,
      startPos: pos,
      min,
      max,
      pos,
    });
  };

  const moveDrag = (e: PointerEvent<HTMLDivElement>, piece: Piece) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const raw =
      drag.startPos +
      ((piece.axis === 'horizontal' ? e.clientX : e.clientY) - drag.origin) /
        cell;
    const pos =
      raw < drag.min
        ? drag.min - resist(drag.min - raw)
        : raw > drag.max
          ? drag.max + resist(raw - drag.max)
          : raw;
    setDrag({ ...drag, pos });
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const target = Math.round(Math.min(drag.max, Math.max(drag.min, drag.pos)));
    const dist = target - drag.startPos;
    setDrag(null);
    if (dist !== 0) {
      onMove({
        pieceId: drag.pieceId,
        dir: dist > 0 ? 1 : -1,
        dist: Math.abs(dist),
      });
    }
  };

  const nudge = (
    e: KeyboardEvent<HTMLDivElement>,
    piece: Piece,
    pos: number
  ) => {
    const horizontal = piece.axis === 'horizontal';
    const dir =
      e.key === (horizontal ? 'ArrowRight' : 'ArrowDown')
        ? 1
        : e.key === (horizontal ? 'ArrowLeft' : 'ArrowUp')
          ? -1
          : 0;
    if (dir === 0 || solved) return;
    e.preventDefault();
    const { min, max } = slideRange(spec, state, piece.id, pos);
    if (dir === 1 ? pos < max : pos > min)
      onMove({ pieceId: piece.id, dir, dist: 1 });
  };

  if (cell === 0) return <div ref={ref} className="sb-stage" />;

  const gap = Math.max(2, Math.round(cell * 0.08));
  const frame = cell * FRAME;
  const floorW = spec.width * cell;
  const floorH = spec.height * cell;
  const exitPiece = pieceOf(spec, spec.exitPieceId);
  const exitSign =
    spec.exitEdge === 'right' || spec.exitEdge === 'bottom' ? 1 : -1;
  const stampOnTop = spec.exitEdge === 'bottom';
  const showRule = !stampOnTop && spec.exitEdge !== 'top';

  const rect = (piece: Piece, pos: number) => {
    const horizontal = piece.axis === 'horizontal';
    return {
      x: (horizontal ? pos : piece.track) * cell + gap / 2,
      y: (horizontal ? piece.track : pos) * cell + gap / 2,
      w: (horizontal ? piece.length : 1) * cell - gap,
      h: (horizontal ? 1 : piece.length) * cell - gap,
    };
  };

  const trackStart = frame + exitPiece.track * cell + gap / 2;
  const notch: CSSProperties =
    spec.exitEdge === 'right'
      ? {
          left: frame + floorW - 1,
          top: trackStart,
          width: frame + 1,
          height: cell - gap,
        }
      : spec.exitEdge === 'left'
        ? { left: 0, top: trackStart, width: frame + 1, height: cell - gap }
        : spec.exitEdge === 'bottom'
          ? {
              left: trackStart,
              top: frame + floorH - 1,
              width: cell - gap,
              height: frame + 1,
            }
          : { left: trackStart, top: 0, width: cell - gap, height: frame + 1 };

  const trayStyle: StyleVars = {
    width: floorW + frame * 2,
    height: floorH + frame * 2,
    '--cell': `${cell}px`,
    '--r': `${Math.round(cell * 0.14)}px`,
  };

  return (
    <div ref={ref} className="sb-stage">
      <div
        className="sb-tray"
        role="group"
        aria-label="SlideBlock board"
        style={trayStyle}
      >
        {showRule && (
          <div
            className="sb-rule"
            style={{
              left: frame,
              top: frame * 0.14,
              width: floorW,
              height: frame * 0.34,
            }}
          />
        )}
        <div
          className="sb-stamp"
          style={{
            top: stampOnTop ? 0 : frame + floorH,
            height: frame,
            fontSize: Math.max(9, frame * 0.36),
          }}
        >
          SlideBlock
        </div>
        <div className={`sb-notch sb-notch-${spec.exitEdge}`} style={notch}>
          <span
            className="sb-notch-arrow"
            style={{ transform: `rotate(${EDGE_ROTATION[spec.exitEdge]}deg)` }}
          >
            <Icon name="chevrons" size={Math.round(frame * 0.8)} />
          </span>
        </div>

        <div
          className="sb-floor"
          style={{ left: frame, top: frame, width: floorW, height: floorH }}
        >
          {spec.pieces.map((piece, order) => {
            const pos = positions.get(piece.id) ?? 0;
            const isExit = piece.id === spec.exitPieceId;
            const dragging = drag !== null && drag.pieceId === piece.id;
            const gone = solved && isExit;
            let shown = drag && dragging ? drag.pos : pos;
            if (gone) shown += exitSign * (piece.length + FRAME + 0.8);
            const r = rect(piece, shown);
            const horizontal = piece.axis === 'horizontal';
            const grooveLong = Math.max(
              cell * 0.3,
              piece.length * cell - gap - cell * 0.8
            );
            const grooveThin = Math.max(3, cell * 0.075);

            const classes = ['sb-piece'];
            if (isExit) classes.push('is-exit');
            if (dragging) classes.push('is-dragging');
            if (gone) classes.push('is-gone');

            return (
              <div
                key={piece.id}
                className={classes.join(' ')}
                role="button"
                tabIndex={solved ? -1 : 0}
                aria-label={`${isExit ? 'Red' : 'Wooden'} block, ${piece.length} long, slides ${
                  horizontal ? 'left and right' : 'up and down'
                }`}
                style={{
                  width: r.w,
                  height: r.h,
                  transform: `translate3d(${r.x}px, ${r.y}px, 0)`,
                  backgroundImage: `url(${textures.get(piece.id)})`,
                  animationDelay: `${order * 40}ms`,
                }}
                onPointerDown={(e) => startDrag(e, piece, pos)}
                onPointerMove={(e) => moveDrag(e, piece)}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => nudge(e, piece, pos)}
              >
                {isExit ? (
                  <span
                    className="sb-exit-arrow"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${EDGE_ROTATION[spec.exitEdge]}deg)`,
                    }}
                  >
                    <Icon name="chevrons" size={Math.round(cell * 0.46)} />
                  </span>
                ) : (
                  <span
                    className="sb-groove"
                    style={{
                      width: horizontal ? grooveLong : grooveThin,
                      height: horizontal ? grooveThin : grooveLong,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
