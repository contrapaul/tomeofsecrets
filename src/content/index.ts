import { CardSet, ClassSet, EncounterPools, Enemy, EnemySet, RelicSet, VialSet, type Card, type ClassDef, type Relic, type Vial } from './schema';
import { CreditSet, type Credit } from './schema/art';
import credits from './credits.json';
import classes from './classes.json';
import relics from './relics.json';
import vials from './vials.json';
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
  return registry;
}
