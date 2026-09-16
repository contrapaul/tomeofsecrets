/**
 * Turn an Aseprite JSON export into the spritesheet the game loads.
 *
 *   npm run art:aseprite -- public/art/enemies/<id>/export.json
 *
 * In Aseprite: File → Export Sprite Sheet, with "JSON Data" on, "Hash" type,
 * and "Tags" as the meta data. Tag your animations `idle`, `attack`, `hurt`,
 * `die`. Every frame must be the enemy's full canvas (400², 600² or 700×900)
 * with the feet 40 px from the bottom, like a still PNG.
 *
 * Writes `idle.json` next to the sheet image with Pixi's `animations` block
 * filled from the frame tags. The scanner picks it up from there.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

interface AseFrame { frame: { x: number; y: number; w: number; h: number }; duration: number; sourceSize: { w: number; h: number } }
interface AseJson {
  frames: Record<string, AseFrame> | AseFrame[];
  meta: { image: string; size: { w: number; h: number }; scale?: string; frameTags?: { name: string; from: number; to: number; direction?: string }[] };
}

const file = process.argv[2];
if (!file) {
  console.error('usage: import-aseprite <export.json>');
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, 'utf8')) as AseJson;
const dir = dirname(file);

// Aseprite's "Array" type gives an array; "Hash" gives an object. Normalise to named frames in order.
const entries: [string, AseFrame][] = Array.isArray(data.frames)
  ? data.frames.map((f, i) => [`frame${i}`, f])
  : Object.entries(data.frames);
const frames: Record<string, AseFrame> = Object.fromEntries(entries);
const names = entries.map(([n]) => n);

const tags = data.meta.frameTags ?? [];
if (!tags.some((t) => t.name === 'idle')) {
  console.error('the export needs a frame tag named "idle"');
  process.exit(1);
}
const animations: Record<string, string[]> = {};
for (const t of tags) {
  const seq = names.slice(t.from, t.to + 1);
  animations[t.name] = t.direction === 'reverse' ? seq.reverse() : t.direction === 'pingpong' ? [...seq, ...seq.slice(1, -1).reverse()] : seq;
}

const image = basename(data.meta.image);
if (!existsSync(join(dir, image))) console.warn(`warning: ${image} is not next to ${basename(file)}; the sheet image must sit in the same folder`);

const sizes = new Set(entries.map(([, f]) => `${f.sourceSize.w}×${f.sourceSize.h}`));
if (sizes.size > 1) console.warn(`warning: frames have mixed sizes (${[...sizes].join(', ')}); every frame should be the full canvas`);

const out = { frames, animations, meta: { image, size: data.meta.size, scale: data.meta.scale ?? '1', format: 'RGBA8888' } };
const target = join(dir, 'idle.json');
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${target}: ${names.length} frames, animations ${Object.keys(animations).join(', ')}`);
