import { BoonSet, CardSet, ClassSet, EncounterPools, Enemy, EnemySet, OriginSet, PageSet, RelicSet, VialSet, type Boon, type Card, type ClassDef, type Origin, type Page, type Relic, type Vial } from './schema';
import { CreditSet, type Credit } from './schema/art';
import credits from './credits.json';
import classes from './classes.json';
import relics from './relics.json';
import vials from './vials.json';
import boons from './boons.json';
import origins from './origins.json';
import pages from './pages.json';
import testCards from './test/cards.json';
import testEnemies from './test/enemies.json';

// Every card file and every enemy file, found by path. Add a file, it is in.
const cardFiles = import.meta.glob('./cards/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const enemyFiles = import.meta.glob('./enemies/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const encounterFiles = import.meta.glob('./encounters/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const eventFiles = import.meta.glob('./events/*.dlg', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;

/** Event scripts by file stem: `a-torn-page` for `./events/a-torn-page.dlg`. */
export function eventSources(): Record<string, string> {
  return Object.fromEntries(Object.entries(eventFiles).map(([path, src]) => [path.replace(/^.*\//, '').replace(/\.dlg$/, ''), src]));
}

export interface ContentRegistry {
  cards: Record<string, Card>;
  enemies: Record<string, Enemy>;
  classes: Record<string, ClassDef>;
  credits: Record<string, Credit>;
  relics: Record<string, Relic>;
  vials: Record<string, Vial>;
  encounters: Record<number, EncounterPools>;
  events: Record<string, string>;
  boons: Record<string, Boon>;
  origins: Record<string, Origin>;
  pages: Record<string, Page>;
}

function index<T extends { id: string }>(items: T[], what: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) {
    if (out[item.id]) throw new Error(`duplicate ${what} id: ${item.id}`);
    out[item.id] = item;
  }
  return out;
}

/**
 * Every content file, validated on load. Throws on the first invalid entry,
 * naming it, so a bad JSON edit fails the test run and the dev boot rather
 * than a fight.
 */
export function loadContent(opts: { fixtures?: boolean } = {}): ContentRegistry {
  const fail = (file: string, issues: { path: PropertyKey[]; message: string }[]) => {
    throw new Error(`${file}: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  };
  const cards: Card[] = [];
  for (const [file, data] of Object.entries(cardFiles)) {
    const r = CardSet.safeParse(data);
    if (!r.success) fail(file, r.error.issues);
    else cards.push(...r.data);
  }
  const enemies: Enemy[] = [];
  for (const [file, data] of Object.entries(enemyFiles)) {
    const r = Enemy.safeParse(data);
    if (!r.success) fail(file, r.error.issues);
    else enemies.push(r.data);
  }
  if (opts.fixtures) {
    const c = CardSet.safeParse(testCards);
    if (!c.success) fail('test/cards.json', c.error.issues);
    else cards.push(...c.data);
    const e = EnemySet.safeParse(testEnemies);
    if (!e.success) fail('test/enemies.json', e.error.issues);
    else enemies.push(...e.data);
  }
  const encounters: Record<number, EncounterPools> = {};
  for (const [file, data] of Object.entries(encounterFiles)) {
    const r = EncounterPools.safeParse(data);
    if (!r.success) fail(file, r.error.issues);
    else encounters[r.data.chapter] = r.data;
  }
  const rl = RelicSet.safeParse(relics);
  if (!rl.success) fail('relics.json', rl.error.issues);
  const vl = VialSet.safeParse(vials);
  if (!vl.success) fail('vials.json', vl.error.issues);
  const cls = ClassSet.safeParse(classes);
  if (!cls.success) throw new Error(`classes.json: ${cls.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const bo = BoonSet.safeParse(boons);
  if (!bo.success) fail('boons.json', bo.error.issues);
  const og = OriginSet.safeParse(origins);
  if (!og.success) fail('origins.json', og.error.issues);
  const pg = PageSet.safeParse(pages);
  if (!pg.success) fail('pages.json', pg.error.issues);
  const cr = CreditSet.safeParse(credits);
  if (!cr.success) throw new Error(`credits.json: ${cr.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const registry: ContentRegistry = {
    cards: index(cards, 'card'),
    enemies: index(enemies, 'enemy'),
    classes: index(cls.data, 'class'),
    credits: index(cr.data, 'credit'),
    relics: index(rl.success ? rl.data : [], 'relic'),
    vials: index(vl.success ? vl.data : [], 'vial'),
    encounters,
    events: eventSources(),
    boons: index(bo.success ? bo.data : [], 'boon'),
    origins: index(og.success ? og.data : [], 'origin'),
    pages: index(pg.success ? pg.data : [], 'page'),
  };
  for (const c of cards) if (c.artist && !registry.credits[c.artist]) throw new Error(`card ${c.id} credits unknown artist ${c.artist}`);
  for (const e of enemies) {
    if (e.artist && !registry.credits[e.artist]) throw new Error(`enemy ${e.id} credits unknown artist ${e.artist}`);
    if (e.secret && !registry.cards[e.secret]) throw new Error(`enemy ${e.id} names unknown secret ${e.secret}`);
    if (e.minion && !registry.enemies[e.minion]) throw new Error(`enemy ${e.id} names unknown minion ${e.minion}`);
  }
  for (const pools of Object.values(encounters)) {
    for (const pool of [pools.easy, pools.normal, pools.elite, pools.boss]) for (const group of pool) for (const id of group) if (!registry.enemies[id]) throw new Error(`encounters chapter ${pools.chapter} names unknown enemy ${id}`);
  }
  for (const c of cls.data) for (const id of c.starter) if (!registry.cards[id]) throw new Error(`class ${c.id} starter references unknown card ${id}`);
  for (const o of Object.values(registry.origins)) {
    if (!registry.relics[o.relic]) throw new Error(`origin ${o.id} names unknown relic ${o.relic}`);
    for (const [out, into] of o.swaps) {
      if (!registry.classes[o.class]?.starter.includes(out)) throw new Error(`origin ${o.id} swaps out ${out}, which is not in the ${o.class} starter deck`);
      if (!registry.cards[into]) throw new Error(`origin ${o.id} swaps in unknown card ${into}`);
    }
  }
  for (const p of Object.values(registry.pages)) {
    if (p.requires && !registry.pages[p.requires]) throw new Error(`page ${p.id} requires unknown page ${p.requires}`);
    for (const id of p.unlocks) {
      const known = p.kind === 'cards' ? registry.cards[id] : p.kind === 'relics' ? registry.relics[id] : p.kind === 'boon' ? registry.boons[id] : p.kind === 'origin' ? registry.origins[id] : ['wolf', 'bear', 'hawk', 'serpent', 'boar'].includes(id);
      if (!known) throw new Error(`page ${p.id} unlocks unknown ${p.kind} ${id}`);
    }
  }
  return registry;
}
