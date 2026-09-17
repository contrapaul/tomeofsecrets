/**
 * Scan public/audio and write src/content/generated/audio.json.
 *
 *   npm run audio            scan and write the manifest
 *   npm run audio -- --check scan and fail on any problem, write nothing
 *
 * Rules (docs/CONTRIBUTING-AUDIO.md):
 *   sfx/<id>.wav            one of the ids in src/content/schema/audio.ts
 *   sfx/<id>-2.wav          extra takes of the same sound; the game picks one at random
 *   music/<key>.mp3|m4a     title, map, fight, elite, boss, tome
 *   music/<key>.json        optional { artist, title, loopStart, loopEnd }
 * .wav, .mp3, .m4a and .ogg are accepted everywhere. Composer ids must be in credits.json.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AudioManifest, MUSIC_KEY, MusicMeta, SFX_IDS } from '../src/content/schema/audio';
import { CreditSet } from '../src/content/schema/art';

const ROOT = new URL('..', import.meta.url).pathname;
const AUDIO = join(ROOT, 'public', 'audio');
const OUT = join(ROOT, 'src', 'content', 'generated', 'audio.json');
const check = process.argv.includes('--check');
const EXTS = ['.wav', '.mp3', '.m4a', '.ogg'];

const problems: string[] = [];
const note = (s: string) => problems.push(s);
const credits = CreditSet.parse(JSON.parse(readFileSync(join(ROOT, 'src', 'content', 'credits.json'), 'utf8')));
const creditIds = new Set(credits.map((c) => c.id));
const sfxIds = new Set<string>(SFX_IDS);

function listFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')).sort() : [];
}

const manifest: AudioManifest = { generated: new Date().toISOString().slice(0, 10), sfx: {}, music: {} };

for (const f of listFiles(join(AUDIO, 'sfx'))) {
  const ext = EXTS.find((e) => f.endsWith(e));
  if (!ext) {
    note(`sfx/${f}: not a sound file (use ${EXTS.join(', ')})`);
    continue;
  }
  const id = f.slice(0, -ext.length).replace(/-\d+$/, '');
  if (!sfxIds.has(id)) {
    note(`sfx/${f}: "${id}" is not a sound the game asks for. Ids: ${SFX_IDS.join(', ')}`);
    continue;
  }
  (manifest.sfx[id] ??= []).push(`audio/sfx/${f}`);
}

for (const f of listFiles(join(AUDIO, 'music'))) {
  if (f.endsWith('.json')) continue;
  const ext = EXTS.find((e) => f.endsWith(e));
  if (!ext) {
    note(`music/${f}: not a sound file (use ${EXTS.join(', ')})`);
    continue;
  }
  const key = f.slice(0, -ext.length);
  if (!MUSIC_KEY.test(key)) {
    note(`music/${f}: "${key}" is not a music key. Keys: title, map, fight, fight-2, fight-3, elite, boss, tome`);
    continue;
  }
  if (manifest.music[key]) {
    note(`music/${f}: "${key}" already has a file; keep one`);
    continue;
  }
  let meta: MusicMeta = {};
  const metaFile = join(AUDIO, 'music', `${key}.json`);
  if (existsSync(metaFile)) {
    const parsed = MusicMeta.safeParse(JSON.parse(readFileSync(metaFile, 'utf8')));
    if (!parsed.success) {
      note(`music/${key}.json: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
      continue;
    }
    meta = parsed.data;
    if (meta.artist && !creditIds.has(meta.artist)) note(`music/${key}.json: artist "${meta.artist}" is not in credits.json`);
  }
  manifest.music[key] = { url: `audio/music/${f}`, ...meta };
}

AudioManifest.parse(manifest);

if (problems.length) {
  console.error(problems.map((p) => `audio: ${p}`).join('\n'));
  process.exit(1);
}
const summary = `audio: ${Object.keys(manifest.sfx).length} of ${SFX_IDS.length} sounds, ${Object.keys(manifest.music).length} music tracks`;
if (check) {
  console.log(`${summary} (ok)`);
} else {
  writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${summary} → src/content/generated/audio.json`);
}
