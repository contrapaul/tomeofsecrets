/**
 * Scan public/art and write src/content/generated/art.json.
 *
 *   npm run art            scan and write the manifest
 *   npm run art -- --check scan and fail on any problem, write nothing
 *   npm run art -- --wanted list the enemies and cards that still have no art
 *
 * Rules (docs/CONTRIBUTING-ART.md):
 *   enemies/<id>/idle.png       required, plus meta.json { id, size, artist }
 *   enemies/<id>/attack.png     optional; hurt.png, dead.png likewise
 *   enemies/<id>/idle.json      optional Pixi spritesheet (from tools/import-aseprite.ts)
 *   cards/<id>.png|webp         500×380
 *   portraits/<id>.png|webp     700×900
 *   backgrounds/<key>/far.png   1920×1080, optional mid.png and near.png (transparent)
 * Every artist id must exist in src/content/credits.json.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ArtManifest, CreditSet, EnemyArtMeta } from '../src/content/schema/art';

const ROOT = new URL('..', import.meta.url).pathname;
const ART = join(ROOT, 'public', 'art');
const OUT = join(ROOT, 'src', 'content', 'generated', 'art.json');
const check = process.argv.includes('--check');
const wanted = process.argv.includes('--wanted');

const SIZES = { small: [400, 400], medium: [600, 600], large: [700, 900] } as const;
const problems: string[] = [];
const note = (s: string) => problems.push(s);

const credits = CreditSet.parse(JSON.parse(readFileSync(join(ROOT, 'src', 'content', 'credits.json'), 'utf8')));
const creditIds = new Set(credits.map((c) => c.id));

async function dims(file: string): Promise<{ width: number; height: number }> {
  const m = await sharp(file).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0 };
}

/** First row with any visible pixel, so badges can sit above the head rather than the canvas. */
async function visibleTop(file: string): Promise<number> {
  const { info } = await sharp(file).ensureAlpha().trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
  return Math.max(0, -(info.trimOffsetTop ?? 0));
}

function listDirs(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory() && !d.startsWith('.')) : [];
}
function listFiles(dir: string, exts: string[]): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => exts.some((e) => f.endsWith(e))) : [];
}

const manifest: ArtManifest = { generated: new Date().toISOString().slice(0, 10), enemies: {}, cards: {}, portraits: {}, backgrounds: {} };

for (const id of listDirs(join(ART, 'enemies'))) {
  const dir = join(ART, 'enemies', id);
  const metaFile = join(dir, 'meta.json');
  const idle = join(dir, 'idle.png');
  if (!existsSync(metaFile)) {
    note(`enemies/${id}: missing meta.json`);
    continue;
  }
  const parsed = EnemyArtMeta.safeParse(JSON.parse(readFileSync(metaFile, 'utf8')));
  if (!parsed.success) {
    note(`enemies/${id}/meta.json: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    continue;
  }
  const meta = parsed.data;
  if (meta.id !== id) note(`enemies/${id}/meta.json: id "${meta.id}" does not match the folder`);
  if (!creditIds.has(meta.artist)) note(`enemies/${id}: artist "${meta.artist}" is not in credits.json`);
  if (!existsSync(idle)) {
    note(`enemies/${id}: missing idle.png`);
    continue;
  }
  const d = await dims(idle);
  const [w, h] = SIZES[meta.size];
  if (d.width !== w || d.height !== h) note(`enemies/${id}/idle.png is ${d.width}×${d.height}; a ${meta.size} enemy is ${w}×${h}`);
  for (const pose of ['attack', 'hurt', 'dead'] as const) {
    const f = join(dir, `${pose}.png`);
    if (!existsSync(f)) continue;
    const pd = await dims(f);
    if (pd.width !== d.width || pd.height !== d.height) note(`enemies/${id}/${pose}.png must match idle.png (${d.width}×${d.height})`);
  }
  const entry: ArtManifest['enemies'][string] = {
    idle: `art/enemies/${id}/idle.png`,
    size: meta.size,
    artist: meta.artist,
    width: d.width,
    height: d.height,
    top: await visibleTop(idle),
  };
  if (meta.baseline !== undefined) entry.baseline = meta.baseline;
  if (meta.float) entry.float = meta.float;
  for (const pose of ['attack', 'hurt', 'dead'] as const) if (existsSync(join(dir, `${pose}.png`))) entry[pose] = `art/enemies/${id}/${pose}.png`;
  if (existsSync(join(dir, 'idle.json'))) entry.sheet = `art/enemies/${id}/idle.json`;
  manifest.enemies[id] = entry;
}

for (const f of listFiles(join(ART, 'cards'), ['.png', '.webp'])) {
  const id = f.replace(/\.(png|webp)$/, '');
  const d = await dims(join(ART, 'cards', f));
  if (d.width !== 500 || d.height !== 380) note(`cards/${f} is ${d.width}×${d.height}; card art is 500×380`);
  manifest.cards[id] = { url: `art/cards/${f}` };
}

for (const f of listFiles(join(ART, 'portraits'), ['.png', '.webp'])) {
  const id = f.replace(/\.(png|webp)$/, '');
  const d = await dims(join(ART, 'portraits', f));
  if (d.width !== 700 || d.height !== 900) note(`portraits/${f} is ${d.width}×${d.height}; a portrait is 700×900`);
  manifest.portraits[id] = `art/portraits/${f}`;
}

for (const key of listDirs(join(ART, 'backgrounds'))) {
  const dir = join(ART, 'backgrounds', key);
  const far = ['far.png', 'far.webp'].find((f) => existsSync(join(dir, f)));
  if (!far) {
    note(`backgrounds/${key}: missing far.png`);
    continue;
  }
  const d = await dims(join(dir, far));
  if (d.width !== 1920 || d.height !== 1080) note(`backgrounds/${key}/${far} is ${d.width}×${d.height}; a background is 1920×1080`);
  const near = ['near.png', 'near.webp'].find((f) => existsSync(join(dir, f)));
  const mid = ['mid.png', 'mid.webp'].find((f) => existsSync(join(dir, f)));
  for (const layer of [near, mid]) {
    if (!layer) continue;
    const ld = await dims(join(dir, layer));
    if (ld.width !== 1920 || ld.height !== 1080) note(`backgrounds/${key}/${layer} is ${ld.width}×${ld.height}; a background layer is 1920×1080`);
  }
  manifest.backgrounds[key] = { far: `art/backgrounds/${key}/${far}`, ...(mid ? { mid: `art/backgrounds/${key}/${mid}` } : {}), ...(near ? { near: `art/backgrounds/${key}/${near}` } : {}) };
}

ArtManifest.parse(manifest);

if (problems.length) {
  console.error(problems.map((p) => `art: ${p}`).join('\n'));
  process.exit(1);
}
if (wanted) {
  // Content is plain JSON, so the list needs no Vite: read the files directly.
  const read = (rel: string) => JSON.parse(readFileSync(join(ROOT, 'src', 'content', rel), 'utf8')) as Record<string, unknown>[];
  const enemyDir = join(ROOT, 'src', 'content', 'enemies');
  const enemies: { id: string; name: string; size: string; rank?: string }[] = [];
  for (const chapter of listDirs(enemyDir)) for (const f of listFiles(join(enemyDir, chapter), ['.json'])) enemies.push(JSON.parse(readFileSync(join(enemyDir, chapter, f), 'utf8')));
  const cards = ['paladin', 'tracker', 'mage', 'neutral', 'secrets'].flatMap((f) => read(`cards/${f}.json`)) as { id: string; name: string; class: string; rarity: string }[];
  const drawnEnemies = enemies.filter((e) => manifest.enemies[e.id] && manifest.enemies[e.id]!.artist !== 'placeholder').length;
  console.log(`\nENEMIES WANTED (${enemies.length - drawnEnemies} of ${enemies.length}) — template size in brackets\n`);
  for (const e of enemies) {
    if (manifest.enemies[e.id] && manifest.enemies[e.id]!.artist !== 'placeholder') continue;
    console.log(`  ${e.id.padEnd(22)} ${e.name.padEnd(24)} [${e.size}${e.rank && e.rank !== 'normal' ? `, ${e.rank}` : ''}]`);
  }
  const drawnCards = cards.filter((c) => manifest.cards[c.id]).length;
  console.log(`\nCARDS WANTED (${cards.length - drawnCards} of ${cards.length}) — 500×380, only the middle band shows\n`);
  for (const c of cards) {
    if (manifest.cards[c.id]) continue;
    console.log(`  ${c.id.padEnd(24)} ${c.name.padEnd(26)} ${c.class} · ${c.rarity}`);
  }
  console.log('');
  process.exit(0);
}
const summary = `art: ${Object.keys(manifest.enemies).length} enemies, ${Object.keys(manifest.cards).length} cards, ${Object.keys(manifest.portraits).length} portraits, ${Object.keys(manifest.backgrounds).length} backgrounds`;
if (check) {
  console.log(`${summary} (check only)`);
} else {
  writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${summary} → src/content/generated/art.json`);
}
