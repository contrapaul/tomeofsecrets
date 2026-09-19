/**
 * Writes the downloadable templates students draw over, plus the sample art
 * the dev pages use. All from SVG so there is nothing binary to hand-edit.
 *
 *   npm run art:templates
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const T = join(ROOT, 'public', 'art', 'templates');
mkdirSync(T, { recursive: true });

const BASELINE = 40;

function template(w: number, h: number, label: string): string {
  const y = h - BASELINE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="#7a7a7a" stroke-dasharray="8 6"/>
  <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#d4a83b" stroke-width="2" stroke-dasharray="14 8"/>
  <text x="${w / 2}" y="${y + 26}" font-family="Helvetica, Arial" font-size="18" fill="#d4a83b" text-anchor="middle">feet on this line</text>
  <text x="${w / 2}" y="34" font-family="Helvetica, Arial" font-size="20" fill="#7a7a7a" text-anchor="middle">${label} · ${w}×${h} · faces left ←</text>
  <path d="M ${w * 0.62} ${h * 0.5} l -40 0 m 0 0 l 14 -10 m -14 10 l 14 10" stroke="#7a7a7a" stroke-width="3" fill="none"/>
</svg>`;
}

async function write(svg: string, file: string): Promise<void> {
  await sharp(Buffer.from(svg)).png().toFile(file);
}

await write(template(400, 400, 'small enemy'), join(T, 'enemy-small.png'));
await write(template(600, 600, 'medium enemy'), join(T, 'enemy-medium.png'));
await write(template(700, 640, 'large enemy'), join(T, 'enemy-large.png'));
// Card art is cropped to the slot's 216:122 ratio: of a 500×380 drawing the middle 282 rows show.
await write(
  `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="380"><rect x="0.5" y="0.5" width="499" height="379" fill="none" stroke="#7a7a7a" stroke-dasharray="8 6"/><rect x="1" y="49" width="498" height="282" fill="none" stroke="#d4a83b" stroke-width="2"/><text x="250" y="40" font-family="Helvetica, Arial" font-size="18" fill="#7a7a7a" text-anchor="middle">card art · 500×380 · no text, no border</text><text x="250" y="195" font-family="Helvetica, Arial" font-size="20" fill="#d4a83b" text-anchor="middle">only the gold band shows on the card</text><text x="250" y="222" font-family="Helvetica, Arial" font-size="16" fill="#d4a83b" text-anchor="middle">it is drawn about half this size · big shapes, strong contrast</text></svg>`,
  join(T, 'card.png'),
);
// A fight background: where the floor is, where the hand covers, and the drift margin.
await write(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect x="0.5" y="0.5" width="1919" height="1079" fill="none" stroke="#7a7a7a" stroke-dasharray="8 6"/><rect x="40" y="40" width="1840" height="1000" fill="none" stroke="#7a7a7a" stroke-dasharray="4 8"/><line x1="0" y1="640" x2="1920" y2="640" stroke="#d4a83b" stroke-width="3"/><rect x="0" y="810" width="1920" height="270" fill="#000" opacity="0.18"/><rect x="0" y="0" width="1920" height="64" fill="#000" opacity="0.18"/><text x="960" y="630" font-family="Helvetica, Arial" font-size="22" fill="#d4a83b" text-anchor="middle">enemies stand on this line · the hero stands at the left, around x 250</text><text x="960" y="950" font-family="Helvetica, Arial" font-size="22" fill="#9a9a9a" text-anchor="middle">the hand covers this band · keep it simple here</text><text x="960" y="44" font-family="Helvetica, Arial" font-size="18" fill="#9a9a9a" text-anchor="middle">relics and vials sit along the top</text><text x="960" y="360" font-family="Helvetica, Arial" font-size="22" fill="#7a7a7a" text-anchor="middle">background · 1920×1080 · far.png opaque, near.png transparent foreground, mid.png optional · nothing important inside the outer 40 px</text></svg>`,
  join(T, 'background.png'),
);
await write(
  `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="900"><rect x="0.5" y="0.5" width="699" height="899" fill="none" stroke="#7a7a7a" stroke-dasharray="8 6"/><text x="350" y="450" font-family="Helvetica, Arial" font-size="22" fill="#7a7a7a" text-anchor="middle">portrait · 700×900 · bust, faces inward</text></svg>`,
  join(T, 'portrait.png'),
);
writeFileSync(join(T, 'meta.example.json'), JSON.stringify({ id: 'your-enemy-id', size: 'medium', artist: 'your-credits-id', notes: 'anything the game should know' }, null, 2) + '\n');

// ---- sample art, so the pipeline has something to chew on

function creature(w: number, h: number, body: string, eye: string, extra = ''): string {
  const y = h - BASELINE;
  const bw = w * 0.62;
  const bh = h * 0.55;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><radialGradient id="g" cx="40%" cy="30%"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient></defs>
  <path d="M ${w / 2 - bw / 2} ${y} q ${-bw * 0.12} ${-bh} ${bw * 0.45} ${-bh} q ${bw * 0.62} ${0} ${bw * 0.55} ${bh} z" fill="${body}" stroke="#1a1207" stroke-width="6" stroke-linejoin="round"/>
  <path d="M ${w / 2 - bw / 2} ${y} q ${-bw * 0.12} ${-bh} ${bw * 0.45} ${-bh} q ${bw * 0.62} ${0} ${bw * 0.55} ${bh} z" fill="url(#g)"/>
  <ellipse cx="${w * 0.38}" cy="${y - bh * 0.72}" rx="${w * 0.07}" ry="${w * 0.085}" fill="#fff"/>
  <ellipse cx="${w * 0.36}" cy="${y - bh * 0.7}" rx="${w * 0.035}" ry="${w * 0.05}" fill="${eye}"/>
  <path d="M ${w * 0.3} ${y - bh * 0.42} q ${w * 0.1} ${w * 0.06} ${w * 0.22} 0" stroke="#1a1207" stroke-width="6" fill="none" stroke-linecap="round"/>
  ${extra}
</svg>`;
}

mkdirSync(join(ROOT, 'public', 'art', 'enemies', 'dummy-brute'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'art', 'enemies', 'dummy-cur'), { recursive: true });
await write(creature(700, 640, '#7a7a6a', '#1a1207', `<path d="M 200 250 l -70 -90 l 40 110 z M 500 250 l 70 -90 l -40 110 z" fill="#5a5a4a" stroke="#1a1207" stroke-width="6"/>`), join(ROOT, 'public', 'art', 'enemies', 'dummy-brute', 'idle.png'));
await write(creature(700, 640, '#8a8a7a', '#9b2335', `<path d="M 200 250 l -110 -60 l 80 90 z M 500 250 l 110 -60 l -80 90 z" fill="#5a5a4a" stroke="#1a1207" stroke-width="6"/>`), join(ROOT, 'public', 'art', 'enemies', 'dummy-brute', 'attack.png'));
writeFileSync(join(ROOT, 'public', 'art', 'enemies', 'dummy-brute', 'meta.json'), JSON.stringify({ id: 'dummy-brute', size: 'large', artist: 'placeholder', notes: 'sample art from tools/make-templates.ts' }, null, 2) + '\n');
await write(creature(400, 400, '#8a5a2a', '#1a1207', `<path d="M 120 190 l -30 -70 l 60 40 z M 250 190 l 30 -70 l -60 40 z" fill="#6a4a2a" stroke="#1a1207" stroke-width="5"/>`), join(ROOT, 'public', 'art', 'enemies', 'dummy-cur', 'idle.png'));
writeFileSync(join(ROOT, 'public', 'art', 'enemies', 'dummy-cur', 'meta.json'), JSON.stringify({ id: 'dummy-cur', size: 'small', artist: 'placeholder', notes: 'sample art from tools/make-templates.ts' }, null, 2) + '\n');

await write(
  `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="380"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1a4a"/><stop offset="1" stop-color="#0b0a0f"/></linearGradient></defs><rect width="500" height="380" fill="url(#s)"/><circle cx="250" cy="190" r="90" fill="none" stroke="#8b6ad8" stroke-width="10"/><circle cx="250" cy="190" r="40" fill="#e6dcff"/><path d="M 250 60 v 40 M 250 280 v 40 M 120 190 h 40 M 340 190 h 40" stroke="#8b6ad8" stroke-width="8" stroke-linecap="round"/></svg>`,
  join(ROOT, 'public', 'art', 'cards', 'arcane-bolt.png'),
);

mkdirSync(join(ROOT, 'public', 'art', 'backgrounds', 'chapter1'), { recursive: true });
await write(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2a22"/><stop offset="1" stop-color="#0b0f0c"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#sky)"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 150 - 40}" y="${120 + (i % 3) * 60}" width="70" height="900" fill="#111a14" opacity="0.8"/>`).join('')}</svg>`,
  join(ROOT, 'public', 'art', 'backgrounds', 'chapter1', 'far.png'),
);
await write(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 240 + 30}" y="${40 + (i % 2) * 80}" width="120" height="1040" fill="#0a0d0a" opacity="0.9"/>`).join('')}<ellipse cx="960" cy="1040" rx="1100" ry="120" fill="#070907"/></svg>`,
  join(ROOT, 'public', 'art', 'backgrounds', 'chapter1', 'near.png'),
);
console.log('templates and sample art written');
