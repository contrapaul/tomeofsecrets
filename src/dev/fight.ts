import { loadContent } from '../content';
import type { Scene, SceneContext } from '../app/router';
import type { ClassId } from '../content/schema';
import { combatScene } from '../ui/scenes/combat';

/** Until Phase 3's starters exist, each class fights with fixture cards that show off its mechanics. */
const DECKS: Record<ClassId, string[]> = {
  paladin: ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'test-generator', 'test-generator', 'test-verdict', 'test-power', 'bash', 'second-look'],
  tracker: ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'test-sic', 'test-trap', 'test-x', 'twin-strike', 'missiles', 'trip'],
  mage: ['strike', 'strike', 'defend', 'defend', 'defend', 'test-frost', 'test-frost', 'test-frost', 'cleave', 'inflame', 'test-exhaust', 'grit'],
};
const HP: Record<ClassId, number> = { paladin: 80, tracker: 70, mage: 65 };

/** `strike*5,defend+*4,bash` → card list; `+` upgrades, `*n` repeats. */
function parseDeck(spec: string, content: ReturnType<typeof loadContent>): { cardId: string; upgraded: boolean }[] {
  const out: { cardId: string; upgraded: boolean }[] = [];
  for (const part of spec.split(',')) {
    const m = /^([a-z0-9-]+)(\+)?(?:\*(\d+))?$/.exec(part.trim());
    if (!m || !content.cards[m[1]!]) continue;
    for (let i = 0; i < (m[3] ? Number(m[3]) : 1); i++) out.push({ cardId: m[1]!, upgraded: !!m[2] });
  }
  return out;
}

/** #/dev/fight?class=mage&enemies=dummy-brute,dummy-cur&seed=abc[&deck=strike*5,defend*5] */
export function devFightScene(ctx: SceneContext): Scene {
  const content = loadContent({ fixtures: true });
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const classId = (params.get('class') as ClassId) in DECKS ? (params.get('class') as ClassId) : 'paladin';
  const enemies = (params.get('enemies') ?? 'dummy-brute,dummy-cur').split(',').filter((e) => content.enemies[e]);
  const seed = params.get('seed') ?? `dev-${Date.now() % 100000}`;
  const custom = params.get('deck') ? parseDeck(params.get('deck')!, content) : [];
  const deck = custom.length ? custom : DECKS[classId].map((cardId) => ({ cardId, upgraded: false }));
  return combatScene(ctx, content, {
    hero: { classId, maxHp: HP[classId], deck, companion: classId === 'tracker' ? 'wolf' : undefined },
    encounter: { enemies: enemies.length ? enemies : ['dummy-brute'] },
    seed,
  });
}
