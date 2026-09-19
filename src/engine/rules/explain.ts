import type { Amount, Effect, Enemy, GlossaryEntry, GlossaryKind, IntentKind, Relic, ResourceName, Vial } from '../../content/schema';
import { HAND_LIMIT, RESOURCE_CAP, TRAP_LIMIT } from './effects';
import { FREEZE_AT, MARK_BONUS, SHATTER_DAMAGE } from './statuses';
import { describeResolved, STATUS_NAMES, type LiveContext, type Segment } from './text';
import type { Content, Intent } from './types';
import type { ResolvedCard } from './cards';

/**
 * What a thing means, in the glossary's words (docs/plans.md Phase 6.1).
 * Every card, relic, vial, status and enemy move resolves to the glossary
 * entries it touches, so the same sentence explains Weak everywhere.
 */

/** Numbers the glossary quotes, so its text cannot drift from the rules. */
export const GLOSSARY_TOKENS: Record<string, number> = {
  FREEZE_AT,
  SHATTER_DAMAGE,
  MARK_BONUS,
  HAND_LIMIT,
  TRAP_LIMIT,
  CAP_holyPower: RESOURCE_CAP.holyPower,
  CAP_charge: RESOURCE_CAP.charge,
};

export interface Note {
  id: string;
  kind: GlossaryKind | 'header';
  name: string;
  text: string;
}

export interface Explanation {
  title: string;
  body: Segment[];
  notes: Note[];
}

export function fillTokens(text: string): string {
  return text.replace(/\{([A-Za-z_]+)\}/g, (m, key: string) => (key in GLOSSARY_TOKENS ? String(GLOSSARY_TOKENS[key]) : m));
}

/** One glossary entry as a note, tokens filled. Null for an unknown id. */
export function term(content: Content, id: string): Note | null {
  const e: GlossaryEntry | undefined = content.glossary?.[id];
  return e ? { id: e.id, kind: e.kind, name: e.name, text: fillTokens(e.text) } : null;
}

function notesFor(content: Content, ids: string[]): Note[] {
  const out: Note[] = [];
  for (const id of ids) {
    const n = term(content, id);
    if (n && !out.some((x) => x.id === id)) out.push(n);
  }
  return out;
}

// ---------------------------------------------------------------- what an effect list touches

/** Glossary ids an effect list refers to, in order of first appearance. */
export function termsOfEffects(effects: Effect[]): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (!out.includes(id)) out.push(id);
  };
  const walk = (list: Effect[]) => {
    for (const ef of list) {
      switch (ef.do) {
        case 'damage':
          if (ef.target === 'all') add('allEnemies');
          break;
        case 'block':
          add('block');
          break;
        case 'status':
          add(ef.status);
          if (ef.target === 'companion') add('companion');
          if (ef.target === 'all') add('allEnemies');
          break;
        case 'removeStatus':
          if (ef.status !== 'debuffs' && ef.status !== 'buffs') add(ef.status);
          break;
        case 'energy':
          add('energy');
          break;
        case 'resource':
          add(ef.name);
          break;
        case 'spend':
          add(ef.name);
          walk(ef.then);
          break;
        case 'exhaust':
          add('exhaust');
          break;
        case 'trap':
          add('armed');
          add(`trap-${ef.trigger}`);
          walk(ef.effects);
          break;
        case 'companion':
          add('companion');
          if (ef.action === 'enrage') add('enraged');
          if (ef.action === 'unstun') add('stun');
          break;
        case 'power':
          walk(ef.effects);
          break;
        case 'script':
          for (const id of termsOfScript(ef.id)) add(id);
          break;
        case 'if': {
          const c = ef.when;
          if ('targetHas' in c) add(c.targetHas);
          if ('resourceAtLeast' in c) add(c.resourceAtLeast);
          walk(ef.then);
          if (ef.else) walk(ef.else);
          break;
        }
        default:
          break;
      }
    }
  };
  walk(effects);
  return out;
}

export function termsOfCard(card: ResolvedCard): string[] {
  const ids = termsOfEffects(card.effects);
  if (card.cost === 'X') ids.unshift('xcost');
  for (const k of card.keywords) if (!ids.includes(k)) ids.push(k);
  if (card.onDraw) for (const id of termsOfEffects(card.onDraw)) if (!ids.includes(id)) ids.push(id);
  return ids;
}

// ---------------------------------------------------------------- explanations

export function explainCard(content: Content, card: ResolvedCard, live?: LiveContext): Explanation {
  return { title: card.name, body: describeResolved(card, live), notes: notesFor(content, termsOfCard(card)) };
}

function relicTerms(relic: Relic): string[] {
  const ids: string[] = [];
  const c = relic.combat;
  if (c?.resource) ids.push(c.resource.name);
  for (const list of [c?.fightStart, c?.turnStart]) if (list) for (const id of termsOfEffects(list)) if (!ids.includes(id)) ids.push(id);
  return ids;
}

export function explainRelic(content: Content, relic: Relic): Explanation {
  return { title: relic.name, body: [{ text: relic.text }], notes: notesFor(content, relicTerms(relic)) };
}

export function explainVial(content: Content, vial: Vial): Explanation {
  return { title: vial.name, body: [{ text: vial.text }], notes: notesFor(content, termsOfEffects(vial.effects)) };
}

export function explainStatus(content: Content, id: string, amount?: number): Explanation {
  const n = term(content, id);
  const name = n?.name ?? STATUS_NAMES[id as keyof typeof STATUS_NAMES] ?? id;
  const related = content.glossary?.[id]?.related ?? [];
  return { title: amount !== undefined ? `${name} ${amount}` : name, body: [{ text: n?.text ?? '' }], notes: notesFor(content, related) };
}

export function explainResource(content: Content, name: ResourceName | 'energy', value?: number): Explanation {
  const n = term(content, name);
  return { title: value !== undefined ? `${n?.name ?? name} ${value}` : n?.name ?? name, body: [{ text: n?.text ?? '' }], notes: [] };
}

export function explainNode(content: Content, type: string): Explanation {
  const n = term(content, `node-${type}`);
  return { title: n?.name ?? type, body: [{ text: n?.text ?? '' }], notes: [] };
}

export function explainTerm(content: Content, id: string): Explanation {
  const n = term(content, id);
  return { title: n?.name ?? id, body: [{ text: n?.text ?? '' }], notes: notesFor(content, content.glossary?.[id]?.related ?? []) };
}

// ---------------------------------------------------------------- enemy moves

/** Scripted moves in words, and the terms they touch; the engine's `scripts/builtin.ts` is the truth. */
const SCRIPT_TEXT: Record<string, { text: Segment[]; terms: string[] }> = {
  split: { text: [{ text: 'Splits into smaller slimes.' }], terms: [] },
  bind: { text: [{ text: 'Binds a card in your hand until you take damage.' }], terms: [] },
  'ink-trap': { text: [{ text: 'Stuns', term: 'stun' }, { text: ' your ' }, { text: 'Companion', term: 'companion' }, { text: ', or if you have none, you lose 1 energy next turn.' }], terms: ['stun', 'companion'] },
};

/** Terms a scripted effect implies, since its effects list is opaque. */
export function termsOfScript(id: string): string[] {
  return SCRIPT_TEXT[id]?.terms ?? [];
}

function amountText(a: Amount): string {
  return typeof a === 'number' ? String(a) : `${a.base}+`;
}

function titleCase(id: string): string {
  return id.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

/** An enemy's move from the player's side: "Hits you for 8. Stuns your Companion." */
function moveBody(content: Content, effects: Effect[], intent: Intent | undefined): Segment[] {
  const out: Segment[] = [];
  const push = (...segs: Segment[]) => {
    if (out.length) out.push({ text: ' ' });
    out.push(...segs);
  };
  const statusSeg = (id: string): Segment => ({ text: STATUS_NAMES[id as keyof typeof STATUS_NAMES] ?? id, term: id });
  for (const ef of effects) {
    switch (ef.do) {
      case 'damage': {
        const n = intent?.damage !== undefined ? String(intent.damage) : amountText(ef.amount);
        const times = ef.times && ef.times > 1 ? `, ${ef.times} times` : '';
        push({ text: `Hits you for ${n}${times}.` });
        break;
      }
      case 'block':
        push({ text: `Gains ${intent?.block ?? amountText(ef.amount)} ` }, { text: 'block', term: 'block' }, { text: '.' });
        break;
      case 'status': {
        const who = ef.target === 'hero' || ef.target === 'target' ? 'you' : ef.target === 'companion' ? 'your Companion' : null;
        if (ef.status === 'stun' && ef.target === 'companion') push({ text: 'Stuns', term: 'stun' }, { text: ' your ' }, { text: 'Companion', term: 'companion' }, { text: '.' });
        else if (who) push({ text: `Applies ${amountText(ef.amount)} ` }, statusSeg(ef.status), { text: ` to ${who}.` });
        else push({ text: `Gains ${amountText(ef.amount)} ` }, statusSeg(ef.status), { text: '.' });
        break;
      }
      case 'removeStatus':
        push({ text: 'Sheds its ' }, ef.status === 'debuffs' || ef.status === 'buffs' ? { text: ef.status } : statusSeg(ef.status), { text: '.' });
        break;
      case 'heal':
        push({ text: `Heals ${amountText(ef.amount)}.` });
        break;
      case 'summon': {
        const n = ef.count ?? 1;
        const name = content.enemies[ef.enemy]?.name ?? titleCase(ef.enemy);
        push({ text: n === 1 ? `Calls a ${name}.` : `Calls ${n} ${name}s.` });
        break;
      }
      case 'addCard': {
        const n = ef.count ?? 1;
        const name = content.cards[ef.card]?.name ?? titleCase(ef.card);
        const where = ef.to === 'hand' ? 'your hand' : ef.to === 'draw' ? 'your draw pile' : 'your discard pile';
        push({ text: n === 1 ? `Puts a ${name} into ${where}.` : `Puts ${n} ${name}s into ${where}.` });
        break;
      }
      case 'if':
        out.push(...(out.length ? [{ text: ' ' }] : []), ...moveBody(content, ef.then, intent));
        break;
      case 'script':
        push(...(SCRIPT_TEXT[ef.id]?.text ?? [{ text: `${titleCase(ef.id)}.` }]));
        break;
      default:
        break;
    }
  }
  return out;
}

export function explainIntent(content: Content, def: Enemy, intent: Intent): Explanation {
  if (intent.hidden) {
    const n = term(content, 'intent-hidden');
    return { title: n?.name ?? 'Hidden', body: [{ text: n?.text ?? '' }], notes: [] };
  }
  const move = def.moves[intent.move];
  const kindNote = term(content, `intent-${intent.kind}`);
  if (!move) return { title: kindNote?.name ?? intent.kind, body: [{ text: kindNote?.text ?? '' }], notes: [] };
  const body = moveBody(content, move.effects, intent);
  const notes = notesFor(content, termsOfEffects(move.effects).filter((id) => id !== 'allEnemies'));
  return { title: move.name ?? titleCase(intent.move), body: body.length ? body : [{ text: kindNote?.text ?? '' }], notes };
}

export function intentKindName(content: Content, kind: IntentKind): string {
  return term(content, `intent-${kind}`)?.name ?? kind;
}
