import raw from './bank.json';
import type { Axis, BoardSpec, Edge, State } from './types';

export type BankEntry = {
  id: number;
  name: string;
  spec: BoardSpec;
  state: State;
  /** Kept so old posts still resolve, but never dealt as a new daily. */
  retired?: boolean;
};

const AXES: readonly Axis[] = ['horizontal', 'vertical'];
const EDGES: readonly Edge[] = ['left', 'right', 'top', 'bottom'];

function oneOf<T extends string>(options: readonly T[], value: string): T {
  const match = options.find((option) => option === value);
  if (match === undefined) throw new Error(`bank.json: unexpected "${value}"`);
  return match;
}

export const BANK: readonly BankEntry[] = raw.map((entry) => ({
  id: entry.id,
  name: entry.name,
  spec: {
    ...entry.spec,
    pieces: entry.spec.pieces.map((piece) => ({
      ...piece,
      axis: oneOf(AXES, piece.axis),
    })),
    exitEdge: oneOf(EDGES, entry.spec.exitEdge),
  },
  state: entry.state,
  retired: 'retired' in entry && entry.retired === true,
}));

/** What a new daily may be drawn from: the bank minus the retired boards. */
export const POOL: readonly BankEntry[] = BANK.filter(
  (entry) => !entry.retired
);
