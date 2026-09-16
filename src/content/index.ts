import { CardSet, ClassSet, EnemySet, type Card, type ClassDef, type Enemy } from './schema';
import { CreditSet, type Credit } from './schema/art';
import credits from './credits.json';
import paladin from './cards/paladin.json';
import tracker from './cards/tracker.json';
import mage from './cards/mage.json';
import neutral from './cards/neutral.json';
import classes from './classes.json';
import status from './cards/status.json';
import curses from './cards/curses.json';
import testCards from './test/cards.json';
import testEnemies from './test/enemies.json';

export interface ContentRegistry {
  cards: Record<string, Card>;
  enemies: Record<string, Enemy>;
  classes: Record<string, ClassDef>;
  credits: Record<string, Credit>;
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
  const cardFiles: [string, unknown][] = [
    ['cards/paladin.json', paladin],
    ['cards/tracker.json', tracker],
    ['cards/mage.json', mage],
    ['cards/neutral.json', neutral],
    ['cards/status.json', status],
    ['cards/curses.json', curses],
  ];
  const enemyFiles: [string, unknown][] = [];
  if (opts.fixtures) {
    cardFiles.push(['test/cards.json', testCards]);
    enemyFiles.push(['test/enemies.json', testEnemies]);
  }
  const cards: Card[] = [];
  for (const [file, data] of cardFiles) {
    const r = CardSet.safeParse(data);
    if (!r.success) throw new Error(`${file}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    cards.push(...r.data);
  }
  const enemies: Enemy[] = [];
  for (const [file, data] of enemyFiles) {
    const r = EnemySet.safeParse(data);
    if (!r.success) throw new Error(`${file}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    enemies.push(...r.data);
  }
  const cls = ClassSet.safeParse(classes);
  if (!cls.success) throw new Error(`classes.json: ${cls.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const cr = CreditSet.safeParse(credits);
  if (!cr.success) throw new Error(`credits.json: ${cr.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const registry = { cards: index(cards, 'card'), enemies: index(enemies, 'enemy'), classes: index(cls.data, 'class'), credits: index(cr.data, 'credit') };
  for (const c of cards) if (c.artist && !registry.credits[c.artist]) throw new Error(`card ${c.id} credits unknown artist ${c.artist}`);
  for (const e of enemies) if (e.artist && !registry.credits[e.artist]) throw new Error(`enemy ${e.id} credits unknown artist ${e.artist}`);
  for (const c of cls.data) for (const id of c.starter) if (!registry.cards[id]) throw new Error(`class ${c.id} starter references unknown card ${id}`);
  return registry;
}
