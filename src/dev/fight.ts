import { loadContent } from '../content';
import type { Scene, SceneContext } from '../app/router';
import type { ClassId } from '../content/schema';
import { combatScene } from '../ui/scenes/combat';

/** A few class cards on top of the starter so a dev fight shows the mechanics. */
const SAMPLER: Record<ClassId, string[]> = {
  paladin: ['judgment', 'templars-verdict', 'word-of-glory', 'consecration', 'blade-of-justice', 'hammer-of-wrath'],
  tracker: ['rapid-fire', 'snake-trap', 'kill-command', 'tracking', 'explosive-trap', 'feed'],
  mage: ['fireball', 'ice-lance', 'arcane-blast', 'frost-nova', 'combustion', 'arcane-barrage'],
};

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

/** #/dev/fight?class=mage&enemies=dummy-brute,dummy-cur&seed=abc[&deck=strike*5,defend*5][&coach=1] */
export function devFightScene(ctx: SceneContext): Scene {
  const content = loadContent({ fixtures: true });
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const classId = (params.get('class') as ClassId) in SAMPLER ? (params.get('class') as ClassId) : 'paladin';
  const cls = content.classes[classId]!;
  const enemies = (params.get('enemies') ?? 'dummy-brute,dummy-cur').split(',').filter((e) => content.enemies[e]);
  const seed = params.get('seed') ?? `dev-${Date.now() % 100000}`;
  const custom = params.get('deck') ? parseDeck(params.get('deck')!, content) : [];
  const deck = custom.length ? custom : [...cls.starter, ...SAMPLER[classId]].map((cardId) => ({ cardId, upgraded: false }));
  return combatScene(ctx, content, {
    hero: { classId, maxHp: cls.hp, deck, companion: cls.companion },
    encounter: { enemies: enemies.length ? enemies : ['dummy-brute'] },
    seed,
    tips: params.get('coach') === '1',
  });
}
