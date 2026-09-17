import type { Card } from '../../content/schema';
import { parseDialogue, type Line, type Script } from '../dialogue/parse';
import type { Content } from '../rules';
import { relicPool, rollVial } from './rewards';
import { addRelic, startFight, type RunState } from './run';

/**
 * Runs a parsed .dlg against the run. The UI drives it: `advance` until it
 * waits, `choose` for a choice, `pick` for a card choice. Everything the
 * player has seen is in `beats`, so the scene can redraw after a resume.
 */

export type Beat =
  | { kind: 'say'; speaker: string | null; text: string }
  | { kind: 'note'; text: string };

export interface DialogueState {
  file: string;
  section: string;
  index: number;
  beats: Beat[];
  waiting: 'continue' | 'choice' | 'pick' | 'fight' | 'done';
  choices: { label: string; target: string }[];
  pick: { kind: 'remove' | 'upgrade' | 'transform'; count: number; chosen: number } | null;
  /** Set while a fight launched by the script is in progress. */
  fightReward: 'normal' | 'double' | null;
}

const scripts = new Map<string, Script>();

/** Register the parsed events (the app does this from a glob of .dlg files). */
export function registerEvents(files: Record<string, string>): void {
  for (const [name, source] of Object.entries(files)) scripts.set(name, parseDialogue(source));
}

export function eventTitle(file: string): string {
  return scripts.get(file)?.title ?? file;
}

export function eventPortraits(file: string): Script['portraits'] {
  return scripts.get(file)?.portraits ?? {};
}

export function knownEvents(): string[] {
  return [...scripts.keys()];
}

export function startDialogue(run: RunState, content: Content, file: string): DialogueState {
  if (!scripts.has(file)) throw new Error(`unknown event ${file}`);
  const state: DialogueState = { file, section: '', index: 0, beats: [], waiting: 'continue', choices: [], pick: null, fightReward: null };
  run.event = { file, state };
  advance(run, content);
  return state;
}

function substitute(run: RunState, content: Content, text: string): string {
  const cls = content.classes?.[run.hero.classId];
  return text.replace(/\{name\}|\{class\}/g, cls?.name ?? run.hero.classId).replace(/\{gold\}/g, String(run.hero.gold)).replace(/\{hp\}/g, String(run.hero.hp));
}

export function evalCondition(run: RunState, cond: string): boolean {
  const m = /^(\w+)\s*(>=|<=|==|<|>|!=)?\s*([\w-]+)?$/.exec(cond.trim());
  if (!m) return false;
  const [, key, op, val] = m;
  const num = Number(val);
  const cmp = (a: number) => (op === '>=' ? a >= num : op === '<=' ? a <= num : op === '>' ? a > num : op === '<' ? a < num : op === '!=' ? a !== num : a === num);
  switch (key) {
    case 'gold': return cmp(run.hero.gold);
    case 'hp': return cmp(run.hero.hp);
    case 'maxhp': return cmp(run.hero.maxHp);
    case 'chapter': return cmp(run.chapter);
    case 'seal': return cmp(0);
    case 'class': return op === '!=' ? run.hero.classId !== val : run.hero.classId === val;
    case 'flag': return !!run.flags?.[val ?? ''];
    case 'relic': return run.hero.relics.includes(val ?? '');
    case 'vials': return cmp(run.hero.vials.length);
    default: return false;
  }
}

/** Run lines until something needs the player. */
export function advance(run: RunState, content: Content): DialogueState | null {
  const ev = run.event;
  if (!ev) return null;
  const st = ev.state;
  if (st.waiting === 'choice' || st.waiting === 'pick' || st.waiting === 'fight' || st.waiting === 'done') return st;
  const script = scripts.get(st.file)!;
  for (;;) {
    const lines = script.sections[st.section] ?? [];
    const line: Line | undefined = lines[st.index];
    if (!line) {
      st.waiting = 'done';
      return st;
    }
    st.index++;
    switch (line.kind) {
      case 'say':
        st.beats.push({ kind: 'say', speaker: line.speaker, text: substitute(run, content, line.text) });
        st.waiting = 'continue';
        return st;
      case 'choice':
        st.choices = line.options.filter((o) => !o.cond || evalCondition(run, o.cond)).map((o) => ({ label: substitute(run, content, o.label), target: o.target }));
        if (!st.choices.length) st.choices = [{ label: 'Continue', target: line.options[0]!.target }];
        st.waiting = 'choice';
        return st;
      case 'goto':
        st.section = line.target;
        st.index = 0;
        continue;
      case 'end':
        st.waiting = 'done';
        return st;
      case 'effect': {
        const paused = applyEffect(run, content, st, line.op, line.args);
        if (paused) return st;
        continue;
      }
    }
  }
}

export function choose(run: RunState, content: Content, index: number): DialogueState | null {
  const st = run.event?.state;
  if (!st || st.waiting !== 'choice') return st ?? null;
  const c = st.choices[index];
  if (!c) return st;
  st.beats.push({ kind: 'note', text: `→ ${c.label}` });
  st.section = c.target;
  st.index = 0;
  st.choices = [];
  st.waiting = 'continue';
  return advance(run, content);
}

/** Answer a card pick (remove / upgrade / transform) with deck uids. */
export function pick(run: RunState, content: Content, uids: number[]): DialogueState | null {
  const st = run.event?.state;
  if (!st || st.waiting !== 'pick' || !st.pick) return st ?? null;
  const p = st.pick;
  for (const uid of uids.slice(0, p.count)) {
    const i = run.hero.deck.findIndex((c) => c.uid === uid);
    if (i < 0) continue;
    const card = run.hero.deck[i]!;
    if (p.kind === 'remove') {
      run.hero.deck.splice(i, 1);
      st.beats.push({ kind: 'note', text: `Removed ${content.cards[card.cardId]?.name ?? card.cardId}.` });
    } else if (p.kind === 'upgrade') {
      card.upgraded = true;
      st.beats.push({ kind: 'note', text: `Upgraded ${content.cards[card.cardId]?.name ?? card.cardId}.` });
    } else {
      const was = content.cards[card.cardId]?.name ?? card.cardId;
      card.cardId = randomCard(run, content, 'any');
      card.upgraded = false;
      st.beats.push({ kind: 'note', text: `${was} became ${content.cards[card.cardId]?.name}.` });
    }
  }
  st.pick = null;
  st.waiting = 'continue';
  return advance(run, content);
}

/** The fight the script asked for has ended (and its reward was taken); carry on. */
export function resumeAfterFight(run: RunState, content: Content): DialogueState | null {
  const st = run.event?.state;
  if (!st || st.waiting !== 'fight') return st ?? null;
  st.fightReward = null;
  st.waiting = 'continue';
  return advance(run, content);
}

function randomCard(run: RunState, content: Content, rarity: 'any' | Card['rarity']): string {
  const pool = Object.values(content.cards).filter((c) => (c.class === run.hero.classId || c.class === 'neutral') && c.rarity !== 'starter' && c.type !== 'status' && c.type !== 'curse' && (rarity === 'any' || c.rarity === rarity));
  return run.rng.events.pick(pool).id;
}

function note(st: DialogueState, text: string): void {
  st.beats.push({ kind: 'note', text });
}

/** Returns true when the effect needs the player before the script can go on. */
function applyEffect(run: RunState, content: Content, st: DialogueState, op: string, args: string[]): boolean {
  const n = (i: number, fallback = 0) => (Number.isFinite(Number(args[i])) ? Number(args[i]) : fallback);
  switch (op) {
    case 'gold': {
      const delta = n(0);
      run.hero.gold = Math.max(0, run.hero.gold + delta);
      note(st, delta >= 0 ? `+${delta} gold` : `${delta} gold`);
      return false;
    }
    case 'hp': {
      const delta = n(0);
      run.hero.hp = Math.max(1, Math.min(run.hero.maxHp, run.hero.hp + delta));
      note(st, delta >= 0 ? `Healed ${delta}` : `Took ${-delta} damage`);
      return false;
    }
    case 'maxhp': {
      const delta = n(0);
      run.hero.maxHp = Math.max(1, run.hero.maxHp + delta);
      run.hero.hp = Math.max(1, Math.min(run.hero.maxHp, run.hero.hp + Math.max(0, delta)));
      note(st, `${delta >= 0 ? '+' : ''}${delta} max HP`);
      return false;
    }
    case 'heal': {
      if (args[0] === 'pct') {
        const amount = Math.round(run.hero.maxHp * (n(1) / 100));
        run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + amount);
        note(st, `Healed ${amount}`);
      } else if (args[0] === 'full') {
        run.hero.hp = run.hero.maxHp;
        note(st, 'Healed to full');
      }
      return false;
    }
    case 'card': {
      const what = args[0];
      if (what === 'add') {
        let id = args[1] ?? '';
        if (id === 'random') id = randomCard(run, content, (args[2] as Card['rarity']) ?? 'any');
        if (!content.cards[id]) return false;
        run.hero.deck.push({ uid: run.nextUid++, cardId: id, upgraded: args.includes('upgraded') });
        note(st, `Gained ${content.cards[id]!.name}${args.includes('upgraded') ? '+' : ''}`);
        return false;
      }
      if (what === 'remove' || what === 'upgrade' || what === 'transform') {
        if (args[1] === 'random') {
          const count = n(2, 1);
          const pool = run.rng.events.shuffle(run.hero.deck.filter((c) => (what === 'upgrade' ? !c.upgraded : true)));
          for (const c of pool.slice(0, count)) {
            if (what === 'upgrade') c.upgraded = true;
            else if (what === 'remove') run.hero.deck.splice(run.hero.deck.indexOf(c), 1);
            else c.cardId = randomCard(run, content, 'any');
          }
          note(st, `${what === 'upgrade' ? 'Upgraded' : what === 'remove' ? 'Removed' : 'Transformed'} ${Math.min(count, pool.length)} random card${count > 1 ? 's' : ''}`);
          return false;
        }
        st.pick = { kind: what, count: n(2, 1), chosen: 0 };
        st.waiting = 'pick';
        return true;
      }
      return false;
    }
    case 'curse': {
      const id = args[0] ?? '';
      if (content.cards[id]?.type === 'curse') {
        run.hero.deck.push({ uid: run.nextUid++, cardId: id, upgraded: false });
        note(st, `Cursed: ${content.cards[id]!.name}`);
      }
      return false;
    }
    case 'relic': {
      let id = args[0] ?? '';
      if (id === 'random') {
        const tier = (args[1] as 'common' | 'uncommon' | 'rare') ?? 'common';
        const pool = relicPool(content, run.hero.classId, tier, run.hero.relics);
        if (!pool.length) return false;
        id = run.rng.events.pick(pool).id;
      }
      if (!content.relics?.[id]) return false;
      addRelic(run, content, id);
      note(st, `Relic: ${content.relics[id]!.name}`);
      return false;
    }
    case 'vial': {
      let id = args[0] ?? '';
      if (id === 'random') id = rollVial(run.rng.events, content) ?? '';
      if (!content.vials?.[id]) return false;
      if (run.hero.vials.length < run.hero.vialSlots) {
        run.hero.vials.push(id);
        note(st, `Vial: ${content.vials[id]!.name}`);
      } else note(st, `No room for ${content.vials[id]!.name}`);
      return false;
    }
    case 'flag': {
      run.flags ??= {};
      if (args[0] === 'set' && args[1]) run.flags[args[1]] = true;
      if (args[0] === 'clear' && args[1]) delete run.flags[args[1]];
      return false;
    }
    case 'fight': {
      const enemies = (args[0] ?? '').split(',').filter((e) => content.enemies[e]);
      if (!enemies.length) return false;
      st.fightReward = args.includes('reward:double') ? 'double' : 'normal';
      st.waiting = 'fight';
      startFight(run, content, 'fight', enemies, true);
      return true;
    }
    case 'pause':
    case 'next':
      return false;
    default:
      note(st, `[${op} ${args.join(' ')}]`);
      return false;
  }
}
