/**
 * Turn a scanned or photographed drawing on white paper into a game-ready
 * enemy PNG: key out the paper, trim, fit onto the template canvas with the
 * feet on the baseline.
 *
 *   npm run art:key -- <input.png> <small|medium|large> <enemy-id> [--artist paul-k] [--float 90]
 *
 * `--float` leaves that many pixels of air under the drawing: a hovering creature.
 *
 * Writes public/art/enemies/<enemy-id>/idle.png and, if missing, meta.json.
 * The paper colour is sampled from the border and removed by flood fill, so
 * white highlights inside the drawing survive. Edge pixels get a soft alpha
 * and have the paper colour divided out, which stops the pale fringe scans
 * otherwise get on dark backgrounds.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const SIZES = { small: [400, 400], medium: [600, 600], large: [700, 900] } as const;
const BASELINE = 40;
const MARGIN = 12;
/** RGB distance from the paper colour that still counts as paper. */
const KEY_TOLERANCE = 48;
/** Distance over which edge pixels fade from transparent to opaque. */
const EDGE_RANGE = 120;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const [input, size, id] = args as [string | undefined, keyof typeof SIZES | undefined, string | undefined];
if (!input || !size || !id || !(size in SIZES) || !/^[a-z0-9-]+$/.test(id)) {
  console.error('usage: npm run art:key -- <input.png> <small|medium|large> <enemy-id> [--artist <credits-id>] [--float <px>]');
  process.exit(2);
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const px = (x: number, y: number) => (y * W + x) * 4;

// Paper colour: the median of the border pixels.
const border: number[][] = [];
for (let x = 0; x < W; x++) border.push([data[px(x, 0)]!, data[px(x, 0) + 1]!, data[px(x, 0) + 2]!], [data[px(x, H - 1)]!, data[px(x, H - 1) + 1]!, data[px(x, H - 1) + 2]!]);
for (let y = 0; y < H; y++) border.push([data[px(0, y)]!, data[px(0, y) + 1]!, data[px(0, y) + 2]!], [data[px(W - 1, y)]!, data[px(W - 1, y) + 1]!, data[px(W - 1, y) + 2]!]);
const median = (k: number) => border.map((p) => p[k]!).sort((a, b) => a - b)[Math.floor(border.length / 2)]!;
const paper = [median(0), median(1), median(2)] as const;
const dist = (i: number) => Math.hypot(data[i]! - paper[0], data[i + 1]! - paper[1], data[i + 2]! - paper[2]);

// Flood fill the paper from the border.
const isPaper = new Uint8Array(W * H);
const stack: number[] = [];
const push = (x: number, y: number) => {
  const n = y * W + x;
  if (isPaper[n] || dist(n * 4) > KEY_TOLERANCE) return;
  isPaper[n] = 1;
  stack.push(n);
};
for (let x = 0; x < W; x++) {
  push(x, 0);
  push(x, H - 1);
}
for (let y = 0; y < H; y++) {
  push(0, y);
  push(W - 1, y);
}
while (stack.length) {
  const n = stack.pop()!;
  const x = n % W;
  const y = (n - x) / W;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

// Alpha: paper is clear; drawing pixels touching paper fade by how far from paper they are,
// with the paper colour divided out so the edge keeps the ink's own colour.
const out = Buffer.from(data);
let minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const n = y * W + x;
    const i = n * 4;
    if (isPaper[n]) {
      out[i + 3] = 0;
      continue;
    }
    const nearPaper = (x > 0 && isPaper[n - 1]) || (x < W - 1 && isPaper[n + 1]) || (y > 0 && isPaper[n - W]) || (y < H - 1 && isPaper[n + W]);
    let a = 1;
    if (nearPaper) {
      a = Math.max(0.15, Math.min(1, dist(i) / EDGE_RANGE));
      for (let k = 0; k < 3; k++) out[i + k] = Math.max(0, Math.min(255, Math.round((data[i + k]! - (1 - a) * paper[k]!) / a)));
    }
    out[i + 3] = Math.round(a * 255);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
if (maxX < 0) {
  console.error('key-scan: nothing but paper in that image');
  process.exit(1);
}

// Trim, fit under the baseline, centre.
const [cw, ch] = SIZES[size];
const float = Math.max(0, Number(flag('float') ?? 0) || 0);
const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
const scale = Math.min((cw - MARGIN * 2) / bw, (ch - BASELINE - float - MARGIN) / bh);
const tw = Math.max(1, Math.round(bw * scale));
const th = Math.max(1, Math.round(bh * scale));
const drawing = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: minX, top: minY, width: bw, height: bh })
  .resize(tw, th, { kernel: scale > 1 ? 'lanczos3' : 'lanczos3' })
  .png()
  .toBuffer();
const dir = join(ROOT, 'public', 'art', 'enemies', id);
mkdirSync(dir, { recursive: true });
await sharp({ create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: drawing, left: Math.round((cw - tw) / 2), top: ch - BASELINE - float - th }])
  .png()
  .toFile(join(dir, 'idle.png'));

const metaFile = join(dir, 'meta.json');
const meta: Record<string, unknown> = existsSync(metaFile) ? (JSON.parse(readFileSync(metaFile, 'utf8')) as Record<string, unknown>) : { id, size, artist: flag('artist') ?? 'placeholder' };
if (float) meta.float = float;
else delete meta.float;
writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`);
console.log(`key-scan: ${input} → enemies/${id}/idle.png (${size} ${cw}×${ch}; paper rgb(${paper.join(',')}); drawing ${bw}×${bh} scaled ×${scale.toFixed(2)} to ${tw}×${th})`);
