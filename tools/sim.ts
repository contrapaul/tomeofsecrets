/**
 * Headless balance sim.
 *
 *   npm run sim -- fight --deck strike*5,defend*4,bash --enemies dummy-brute --games 1000 [--seed s] [--class paladin] [--companion wolf] [--hp 80]
 *
 * Plays the fight with the heuristic player and prints win rate, damage
 * taken, and turns. `sim run` (whole chapters) arrives in Phase 5.
 */
import { loadContent } from '../src/content';
import { playFight } from '../src/engine/ai/heuristic';
import { playRun } from '../src/engine/ai/runner';
import { createCombat, type HeroSetup } from '../src/engine/rules';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function parseDeck(spec: string): { cardId: string; upgraded?: boolean }[] {
  const out: { cardId: string; upgraded?: boolean }[] = [];
  for (const part of spec.split(',')) {
    const m = /^([a-z0-9-]+)(\+)?(?:\*(\d+))?$/.exec(part.trim());
    if (!m) throw new Error(`bad deck entry: ${part}`);
    const n = m[3] ? Number(m[3]) : 1;
    for (let i = 0; i < n; i++) out.push({ cardId: m[1]!, upgraded: !!m[2] });
  }
  return out;
}

const command = process.argv[2];
if (command === 'run') {
  const content = loadContent();
  const games = Number(arg('games', '200'));
  const seed = arg('seed', 'sim')!;
  const classes = (arg('class', 'paladin,tracker,mage')!.split(',')) as HeroSetup['classId'][];
  for (const classId of classes) {
    const t0 = performance.now();
    const results = Array.from({ length: games }, (_, g) => playRun(content, { classId, seed: `${seed}-${g}` }));
    const ms = performance.now() - t0;
    const won = results.filter((r) => r.won).length;
    const floors = results.map((r) => r.floor).sort((a, b) => a - b);
    const hist: Record<number, number> = {};
    for (const f of floors) hist[f] = (hist[f] ?? 0) + 1;
    const deaths: Record<string, number> = {};
    for (const r of results) if (r.deathBy) deaths[r.deathBy] = (deaths[r.deathBy] ?? 0) + 1;
    const topDeaths = Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ');
    console.log(`run     ${classId} · ${games} runs in ${ms.toFixed(0)} ms`);
    console.log(`won     ${((100 * won) / games).toFixed(1)}%   floor avg ${(floors.reduce((a, b) => a + b, 0) / games).toFixed(1)} · median ${floors[Math.floor(games / 2)]}`);
    console.log(`floors  ${Object.entries(hist).map(([f, n]) => `${f}:${n}`).join(' ')}`);
    console.log(`deaths  ${topDeaths || '—'}`);
    console.log('');
  }
  process.exit(0);
}
if (command !== 'fight') {
  console.error('usage: sim fight --deck <spec> --enemies <a,b> [--games N] [--seed s] [--class c] [--companion wolf] [--hp N]\n       sim run [--class a,b] [--games N] [--seed s]');
  process.exit(1);
}

const content = loadContent({ fixtures: true });
const classId = (arg('class', 'paladin') as HeroSetup['classId']);
const cls = content.classes[classId];
if (!cls) throw new Error(`unknown class ${classId}`);
const deck = arg('deck') ? parseDeck(arg('deck')!) : cls.starter.map((cardId) => ({ cardId }));
const enemies = arg('enemies', 'dummy-brute')!.split(',');
const games = Number(arg('games', '1000'));
const seed = arg('seed', 'sim')!;
const companion = (arg('companion') as HeroSetup['companion']) ?? cls.companion;
const maxHp = Number(arg('hp', String(cls.hp)));

const t0 = performance.now();
let wins = 0;
let lost = 0;
let turns = 0;
const losses: number[] = [];
for (let g = 0; g < games; g++) {
  const state = createCombat(content, { classId, maxHp, deck, companion }, { enemies }, `${seed}-${g}`);
  const r = playFight(state, content);
  if (r.won) wins++;
  else lost++;
  turns += r.turns;
  losses.push(r.hpLost);
}
const ms = performance.now() - t0;
losses.sort((a, b) => a - b);
const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
const median = losses[Math.floor(losses.length / 2)] ?? 0;
const mean = losses.reduce((a, b) => a + b, 0) / games;

console.log(`fight   ${enemies.join(' + ')}  vs  ${classId}${companion ? ` (${companion})` : ''}, ${deck.length} cards, ${maxHp} hp`);
console.log(`games   ${games} in ${ms.toFixed(0)} ms (${(ms / games).toFixed(2)} ms each)`);
console.log(`won     ${pct(wins)}   lost ${pct(lost)}`);
console.log(`turns   ${(turns / games).toFixed(1)} avg`);
console.log(`hp lost ${mean.toFixed(1)} avg · ${median} median · ${losses[Math.floor(losses.length * 0.9)]} p90`);
