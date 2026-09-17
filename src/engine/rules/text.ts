import type { Amount, Card, Condition, Effect, PowerTrigger, ScaleBy, StatusId, Target } from '../../content/schema';
import { resolveCard, type ResolvedCard } from './cards';
import { enemy } from './entities';
import { evalAmount } from './effects';
import { calcAttackDamage, calcBlock, getStatus, MARK_BONUS } from './statuses';
import type { CombatState, EffectContext } from './types';

/**
 * Card text is generated from effects, so it can never disagree with the
 * rules. With a live state, numbers reflect Strength, Dexterity, Marks and
 * resources and carry the base value so the UI can colour them.
 */
export interface Segment {
  text: string;
  /** Present for a number the rules computed. `base` is the printed value. */
  num?: { value: number; base: number };
}

export interface LiveContext {
  state: CombatState;
  targetId?: string;
}

const STATUS_NAMES: Record<StatusId, string> = {
  strength: 'Strength', dexterity: 'Dexterity', vulnerable: 'Vulnerable', weak: 'Weak', frail: 'Frail',
  poison: 'Poison', burn: 'Burn', chill: 'Chill', frozen: 'Frozen', mark: 'Mark', thorns: 'Thorns',
  regen: 'Regen', artifact: 'Artifact', platedArmor: 'Plated Armor', metallicize: 'Metallicize',
  intangible: 'Intangible', images: 'Images', stun: 'Stun', wait: 'Wait', ritual: 'Ritual', enrage: 'Enrage', bomb: 'Bomb',
};

const STATUS_ADJ: Partial<Record<StatusId, string>> = {
  chill: 'Chilled', frozen: 'Frozen', mark: 'Marked', burn: 'Burning', poison: 'Poisoned',
  vulnerable: 'Vulnerable', weak: 'Weak', frail: 'Frail', stun: 'Stunned',
};

const PER_LABEL: Record<ScaleBy, string> = {
  holyPower: 'Holy Power', charge: 'Charge', block: 'block', targetBurn: "the target's Burn", targetChill: "the target's Chill",
  targetMark: "the target's Mark", cardsInHand: 'card in hand', energy: 'energy', spent: 'point', strength: 'Strength',
};

const RESOURCE_LABEL = { holyPower: 'Holy Power', charge: 'Charge' } as const;

const TRIGGER_TEXT: Record<PowerTrigger, string> = {
  startTurn: 'At the start of your turn, ',
  endTurn: 'At the end of your turn, ',
  onAttackPlayed: 'Whenever you play an Attack, ',
  onSkillPlayed: 'Whenever you play a Skill, ',
  onCardPlayed: 'Whenever you play a card, ',
  onExhaust: 'Whenever you Exhaust a card, ',
  onEnemyDeath: 'Whenever an enemy dies, ',
  onResourceGain: 'Whenever you gain Holy Power or a Charge, ',
  onEnemyAttack: 'Whenever an enemy attacks you, ',
  onDamageTaken: 'Whenever you take damage, ',
  onFireAttack: 'Whenever you play a Fire Attack, ',
};

export function describeCard(card: Card, upgraded: boolean, live?: LiveContext): Segment[] {
  return describeResolved(resolveCard(card, upgraded), live);
}

export function describeResolved(card: ResolvedCard, live?: LiveContext): Segment[] {
  const out: Segment[] = [];
  // Keywords the text already states (an override may spell them out) are not repeated.
  const mentioned = (k: string) => !!card.text && new RegExp(`\\b${k}\\b`, 'i').test(card.text);
  const keywords = card.keywords.filter((k) => !mentioned(k));
  if (keywords.includes('unplayable')) out.push({ text: 'Unplayable. ' });
  if (card.text) {
    out.push({ text: card.text });
  } else {
    const ctx = live ? { source: { kind: 'hero' as const, cardId: card.id }, targetId: live.targetId } : undefined;
    out.push(...sentences(card.effects, live, ctx, { attackerIsHero: true }));
  }
  const tail = keywords.filter((k) => k !== 'unplayable').map((k) => k[0]!.toUpperCase() + k.slice(1) + '.');
  if (tail.length) out.push({ text: (out.length && !out[out.length - 1]!.text.endsWith(' ') ? ' ' : '') + tail.join(' ') });
  return out;
}

export function plainText(segments: Segment[]): string {
  return segments.map((s) => s.text).join('').replace(/\s+/g, ' ').trim();
}

interface Style {
  attackerIsHero: boolean;
  /** Inside "Spend all X:" the per-point phrasing changes. */
  spending?: boolean;
}

function sentences(effects: Effect[], live: LiveContext | undefined, ctx: EffectContext | undefined, style: Style): Segment[] {
  const out: Segment[] = [];
  for (const ef of effects) {
    const s = sentence(ef, live, ctx, style);
    if (!s.length) continue;
    if (out.length) out.push({ text: ' ' });
    out.push(...s);
  }
  return out;
}

/**
 * A printed number, or a scaled one. A scaled amount renders as its base with
 * a trailing note ("+2 per Charge") that `sentence` places after the unit; with
 * a live state it renders as the computed value instead.
 */
function num(printed: Amount, live: LiveContext | undefined, ctx: EffectContext | undefined, modify?: (v: number) => number): { segs: Segment[]; note: string } {
  if (typeof printed === 'number') {
    const value = live && ctx ? (modify ? modify(printed) : printed) : printed;
    return { segs: [{ text: String(value), num: { value, base: printed } }], note: '' };
  }
  const label = PER_LABEL[printed.per];
  if (live && ctx) {
    const v = modify ? modify(evalAmount(live.state, printed, ctx)) : evalAmount(live.state, printed, ctx);
    return { segs: [{ text: String(v), num: { value: v, base: printed.base } }], note: '' };
  }
  if (printed.base === 0) {
    const mult = printed.mult === 1 ? '' : `${printed.mult}× `;
    const what = printed.per === 'spent' ? 'the points spent' : printed.per === 'block' ? 'your block' : label;
    return { segs: [{ text: `${mult}${what}` }], note: 'equal' };
  }
  return { segs: [{ text: `${printed.base}`, num: { value: printed.base, base: printed.base } }], note: `, +${printed.mult} per ${label}` };
}

/** "Deal N damage." with the scaled note in the right place. */
function unit(verb: string, printed: Amount, live: LiveContext | undefined, ctx: EffectContext | undefined, what: string, tail: string, modify?: (v: number) => number): Segment[] {
  const n = num(printed, live, ctx, modify);
  if (n.note === 'equal') return [{ text: `${verb} ${what} equal to ` }, ...n.segs, { text: `${tail}.` }];
  return [{ text: `${verb} ` }, ...n.segs, { text: ` ${what}${tail}${n.note}.` }];
}

function targetPhrase(t: Target | undefined, fallback: Target): string {
  switch (t ?? fallback) {
    case 'all': return ' to ALL enemies';
    case 'random': return ' to a random enemy';
    case 'companion': return ' to your Companion';
    default: return '';
  }
}

function sentence(ef: Effect, live: LiveContext | undefined, ctx: EffectContext | undefined, style: Style): Segment[] {
  switch (ef.do) {
    case 'damage': {
      const modify = live && ctx && style.attackerIsHero
        ? (v: number) => {
            const target = ctx.targetId ? enemy(live.state, ctx.targetId) : null;
            let d = calcAttackDamage(v, live.state.hero.statuses, target?.statuses ?? {});
            if (target && getStatus(target.statuses, 'mark') > 0) d += MARK_BONUS;
            return d;
          }
        : undefined;
      if (ef.target === 'hero' || ef.target === 'self') return unit('Take', ef.amount, live, ctx, 'damage', '');
      const times = ef.times && ef.times > 1 ? ` ${ef.times} times` : '';
      return unit('Deal', ef.amount, live, ctx, 'damage', `${targetPhrase(ef.target, 'target')}${times}`, modify);
    }
    case 'block': {
      const modify = live && ctx && style.attackerIsHero ? (v: number) => calcBlock(v, live.state.hero.statuses) : undefined;
      return unit('Gain', ef.amount, live, ctx, 'block', '', modify);
    }
    case 'status': {
      const name = STATUS_NAMES[ef.status];
      if (ef.target === 'hero' || ef.target === 'self') {
        if (typeof ef.amount === 'number' && ef.amount < 0) return [{ text: `Lose ${-ef.amount} ${name}.` }];
        return unit('Gain', ef.amount, live, ctx, name, '');
      }
      return unit('Apply', ef.amount, live, ctx, name, targetPhrase(ef.target, 'target'));
    }
    case 'removeStatus': {
      const who = ef.target === 'hero' || ef.target === 'self' ? 'your' : ef.target === 'all' ? "every enemy's" : "the target's";
      const what = ef.status === 'debuffs' ? 'debuffs' : ef.status === 'buffs' ? 'buffs' : STATUS_NAMES[ef.status];
      return [{ text: `Remove ${who} ${what}.` }];
    }
    case 'draw': return [{ text: 'Draw ' }, ...num(ef.amount, live, ctx).segs, { text: '.' }];
    case 'energy': return unit('Gain', ef.amount, live, ctx, 'energy', '');
    case 'heal': {
      if (ef.target && ef.target !== 'hero' && ef.target !== 'self') return [{ text: 'Heal the target ' }, ...num(ef.amount, live, ctx).segs, { text: '.' }];
      return [{ text: 'Heal ' }, ...num(ef.amount, live, ctx).segs, { text: '.' }];
    }
    case 'gold': {
      if (typeof ef.amount === 'number' && ef.amount < 0) return [{ text: `Lose ${-ef.amount} gold.` }];
      return unit('Gain', ef.amount, live, ctx, 'gold', '');
    }
    case 'resource': return [{ text: '+' }, ...num(ef.amount, live, ctx).segs, { text: ` ${RESOURCE_LABEL[ef.name]}.` }];
    case 'spend': {
      const inner = sentences(ef.then, live, ctx ? { ...ctx, spent: live?.state.hero.resources[ef.name] } : undefined, { ...style, spending: true });
      if (inner.length) inner[0]!.text = inner[0]!.text[0]!.toLowerCase() + inner[0]!.text.slice(1);
      const label = ef.name === 'charge' ? 'Charges' : RESOURCE_LABEL[ef.name];
      return [{ text: `Spend all ${label}: ` }, ...inner];
    }
    case 'exhaust':
    case 'discard': {
      const verb = ef.do === 'exhaust' ? 'Exhaust' : 'Discard';
      if (ef.from === 'hand') return [{ text: `${verb} your hand.` }];
      const n = ef.count ?? 1;
      if (ef.from === 'random') return [{ text: n === 1 ? `${verb} a random card.` : `${verb} ${n} random cards.` }];
      return [{ text: n === 1 ? `${verb} a card.` : `${verb} ${n} cards.` }];
    }
    case 'retrieve': {
      const n = ef.count ?? 1;
      const pile = ef.from === 'discard' ? 'discard pile' : 'exhaust pile';
      return [{ text: n === 1 ? `Put a card from your ${pile} into your hand.` : `Put ${n} cards from your ${pile} into your hand.` }];
    }
    case 'addCard': {
      const n = ef.count ?? 1;
      const name = cardName(live, ef.card) + (ef.upgraded ? '+' : '');
      const where = ef.to === 'hand' ? 'your hand' : ef.to === 'draw' ? 'your draw pile' : 'your discard pile';
      return [{ text: n === 1 ? `Add a ${name} to ${where}.` : `Add ${n} ${name}s to ${where}.` }];
    }
    case 'trap': {
      const when = ef.trigger === 'enemyAttack' ? 'when an enemy attacks you' : ef.trigger === 'enemyBuff' ? 'when an enemy buffs itself' : "at the start of the enemies' turn";
      const inner = sentences(ef.effects, live, ctx, { attackerIsHero: false });
      if (inner.length) inner[0]!.text = inner[0]!.text[0]!.toLowerCase() + inner[0]!.text.slice(1);
      return [{ text: `Armed: ${when}, ` }, ...inner];
    }
    case 'companion': {
      if (ef.action === 'act') return [{ text: ef.bonus ? `Your Companion acts now with +${ef.bonus} damage.` : 'Your Companion acts now.' }];
      if (ef.action === 'enrage') return [{ text: 'Enrage your Companion.' }];
      return [{ text: 'Your Companion shakes off Stun.' }];
    }
    case 'power': {
      const inner = sentences(ef.effects, live, ctx, { attackerIsHero: false });
      if (inner.length) inner[0]!.text = inner[0]!.text[0]!.toLowerCase() + inner[0]!.text.slice(1);
      return [{ text: TRIGGER_TEXT[ef.trigger] }, ...inner];
    }
    case 'if': {
      const thenPart = sentences(ef.then, live, ctx, style);
      if (thenPart.length) thenPart[0]!.text = thenPart[0]!.text[0]!.toLowerCase() + thenPart[0]!.text.slice(1);
      const out: Segment[] = [{ text: `If ${conditionText(ef.when)}, ` }, ...thenPart];
      if (ef.else?.length) {
        const elsePart = sentences(ef.else, live, ctx, style);
        elsePart[0]!.text = elsePart[0]!.text[0]!.toLowerCase() + elsePart[0]!.text.slice(1);
        out.push({ text: ' Otherwise, ' }, ...elsePart);
      }
      return out;
    }
    case 'summon': {
      const n = ef.count ?? 1;
      return [{ text: n === 1 ? `Summon a ${enemyName(live, ef.enemy)}.` : `Summon ${n} ${enemyName(live, ef.enemy)}s.` }];
    }
    case 'flag': return [];
    case 'script': return [{ text: `[${ef.id}]` }];
  }
}

function conditionText(c: Condition): string {
  if ('resourceAtLeast' in c) return `you have ${c.amount}+ ${RESOURCE_LABEL[c.resourceAtLeast]}`;
  if ('targetHas' in c) return `the target is ${STATUS_ADJ[c.targetHas] ?? STATUS_NAMES[c.targetHas]}`;
  if ('targetBelowHp' in c) return c.targetBelowHp === 0.5 ? 'the target is below half HP' : `the target is below ${Math.round(c.targetBelowHp * 100)}% HP`;
  if ('heroBelowHp' in c) return c.heroBelowHp === 0.5 ? 'you are below half HP' : `you are below ${Math.round(c.heroBelowHp * 100)}% HP`;
  if ('playedNoAttack' in c) return 'you played no Attack this turn';
  if ('firstCardThisTurn' in c) return 'this is your first card this turn';
  if ('targetTag' in c) return `the target is ${c.targetTag[0]!.toUpperCase()}${c.targetTag.slice(1)}`;
  if ('flag' in c) return c.flag;
  if ('goldAtLeast' in c) return `you have ${c.goldAtLeast}+ gold`;
  return '';
}

function cardName(live: LiveContext | undefined, id: string): string {
  void live;
  return id.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

function enemyName(live: LiveContext | undefined, id: string): string {
  void live;
  return id.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}
