import type { CSSProperties } from 'react';

export type Species = 'maple' | 'beech' | 'ash' | 'padauk' | 'walnut' | 'floor';
export type StyleVars = CSSProperties & Record<`--${string}`, string>;

type Rgb = readonly [number, number, number];
type Tone = { early: Rgb; late: Rgb; ringsPerCell: number };

const TONES: Record<Species, Tone> = {
  maple: { early: [238, 208, 160], late: [186, 140, 86], ringsPerCell: 6 },
  beech: { early: [226, 184, 132], late: [168, 116, 70], ringsPerCell: 8 },
  ash: { early: [238, 218, 176], late: [156, 124, 80], ringsPerCell: 4.5 },
  padauk: { early: [190, 86, 46], late: [112, 36, 18], ringsPerCell: 7 },
  walnut: { early: [116, 76, 45], late: [50, 29, 15], ringsPerCell: 2.4 },
  floor: { early: [62, 41, 26], late: [28, 17, 10], ringsPerCell: 3 },
};

const PX_PER_CELL = 72;
const cache = new Map<string, string>();

function hash(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function lightWood(seed: number): Species {
  const pick = Math.floor(hash(seed, 17, 3) * 3);
  return pick === 0 ? 'maple' : pick === 1 ? 'beech' : 'ash';
}

/** Flat-sawn plank with grain along its length; vertical blocks get the plank turned on end. */
export function woodTexture(
  species: Species,
  alongCells: number,
  acrossCells: number,
  vertical: boolean,
  seed: number
): string {
  const key = `${species}|${alongCells}|${acrossCells}|${vertical}|${seed}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const along = Math.round(alongCells * PX_PER_CELL);
  const across = Math.round(acrossCells * PX_PER_CELL);
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? across : along;
  canvas.height = vertical ? along : across;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const { early, late, ringsPerCell } = TONES[species];
  const ringFreq = ringsPerCell / PX_PER_CELL;
  const phase = hash(seed, 5, 11) * 40;
  const slope = (hash(seed, 9, 13) - 0.5) * 0.004;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;

  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {
      const u = vertical ? py : px;
      const v = vertical ? px : py;
      const warp =
        noise(u * 0.005, v * 0.02 + phase, seed) * 2.2 +
        noise(u * 0.02, v * 0.06, seed + 1) * 0.5;
      const t = v * ringFreq + u * slope + warp + phase;
      const ring = t - Math.floor(t);
      const fiber = noise(u * 0.09, v * 0.8, seed + 2) - 0.5;
      const figure = noise(u * 0.012, v * 0.012, seed + 3) - 0.5;
      const pore = hash(Math.floor(u / 5), Math.floor(v / 1.6), seed + 4) > 0.988 ? 0.3 : 0;
      const k = Math.min(
        1,
        Math.max(0, ring ** 4 * 0.7 + fiber * 0.28 + figure * 0.3 + pore + 0.1)
      );
      const i = (py * canvas.width + px) * 4;
      data[i] = early[0] + (late[0] - early[0]) * k;
      data[i + 1] = early[1] + (late[1] - early[1]) * k;
      data[i + 2] = early[2] + (late[2] - early[2]) * k;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL('image/jpeg', 0.9);
  cache.set(key, url);
  return url;
}
