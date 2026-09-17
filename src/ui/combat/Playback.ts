import type { Container } from 'pixi.js';
import gsap from 'gsap';
import { audio } from '../../app/audio';
import { DEBUFFS } from '../../content/schema';
import type { CombatEvent, DamageKind } from '../../engine/events';
import type { CombatState, Content } from '../../engine/rules';
import { CARD_H, type CardView } from '../cards/CardView';
import type { HandLayout } from '../cards/HandLayout';
import type { PileView } from '../cards/PileView';
import { hitIntensity } from '../fx/impact';
import { floatNumber } from '../fx/numbers';
import { d, done, spatial } from '../kit/motion';
import type { CompanionView } from './CompanionView';
import type { EnemyView } from './EnemyView';
import type { PlayerPanel } from './PlayerPanel';
import type { ResourceWidget } from './ResourceWidget';
import type { TrapRow } from './TrapRow';

/** What playback needs from the scene. */
export interface World {
  state: CombatState;
  content: Content;
  hand: HandLayout;
  floating: Container;
  fx: Container;
  player: PlayerPanel;
  resource: ResourceWidget | null;
  companion: CompanionView | null;
  traps: TrapRow;
  enemies: Map<string, EnemyView>;
  piles: { draw: PileView; discard: PileView; exhaust: PileView };
  /** Build a view for a card instance wherever it is in the piles. */
  makeCardView(cardUid: number): CardView | null;
  addEnemy(id: string): EnemyView | null;
  layoutEnemies(): void;
  banner(text: string, sub?: string): Promise<void>;
  /** Rattle the table, 0..1. */
  shakeScreen(intensity: number): void;
  /** The hero-was-hit flash, coloured by the kind of damage. */
  screenFlash(kind: DamageKind, intensity: number): void;
  slowMo(): Promise<void>;
  positions: { draw: { x: number; y: number }; discard: { x: number; y: number }; exhaust: { x: number; y: number }; center: { x: number; y: number }; powers: { x: number; y: number } };
  onEnd(result: 'won' | 'lost'): void;
}

/**
 * Replays engine events in order as animations. The engine has already
 * finished; every event carries the totals it produced, so views update
 * from the events and never read state mid-playback. At the end, counts are
 * synced from state as a safety net.
 */
export class Playback {
  private inPlay: CardView | null = null;
  private blocks = new Map<string, number>();
  /** Pile counts as the animation has shown them so far; state is ahead of us. */
  private counts = { draw: 0, discard: 0, exhaust: 0 };

  constructor(private readonly w: World) {}

  async play(events: CombatEvent[]): Promise<void> {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      // Consecutive cardMoved events cascade; play them with a stagger and await only the last.
      if (ev.t === 'cardMoved' && events[i + 1]?.t === 'cardMoved') {
        void this.handle(ev, true);
        await wait(d(0.045));
        continue;
      }
      const t0 = performance.now();
      await this.handle(ev, false);
      if (import.meta.env.DEV) (window as unknown as { __tome?: { timings?: [string, number][] } }).__tome?.timings?.push([ev.t, Math.round(performance.now() - t0)]);
    }
    this.syncCounts();
  }

  private showCounts(): void {
    this.w.piles.draw.setCount(this.counts.draw);
    this.w.piles.discard.setCount(this.counts.discard);
    this.w.piles.exhaust.setCount(this.counts.exhaust);
  }

  private block(id: string): number {
    return this.blocks.get(id) ?? 0;
  }

  /** A card's view, whether it is in the hand or was just dragged into the floating layer. */
  private findView(uid: number): CardView | null {
    const inHand = this.w.hand.find(uid);
    if (inHand) return inHand;
    for (const child of this.w.floating.children) {
      if ((child as CardView).cardUid === uid) return child as CardView;
    }
    return null;
  }

  private async handle(ev: CombatEvent, inCascade: boolean): Promise<void> {
    const w = this.w;
    switch (ev.t) {
      case 'fightStart':
        return;
      case 'turnStart':
        if (ev.side === 'hero') {
          audio().play('turn-start');
          await w.banner('YOUR TURN', `turn ${ev.turn}`);
        } else await w.banner('ENEMY TURN');
        return;
      case 'draw': {
        for (const [k, uid] of ev.uids.entries()) {
          this.counts.draw = Math.max(0, this.counts.draw - 1);
          this.showCounts();
          const view = w.makeCardView(uid);
          if (!view) continue;
          audio().play('card-draw', { volume: 0.7 });
          view.position.set(w.positions.draw.x - w.hand.x, w.positions.draw.y - w.hand.y);
          view.scale.set(0.3);
          view.rotation = -0.4;
          w.hand.add(view);
          w.hand.layout();
          if (k < ev.uids.length - 1) await wait(d(0.06));
        }
        await wait(d(0.2));
        return;
      }
      case 'shuffle': {
        this.counts.draw = ev.count;
        this.counts.discard = 0;
        this.showCounts();
        await w.banner('', 'shuffle');
        return;
      }
      case 'play': {
        const view = this.findView(ev.uid);
        if (!view) return;
        if (view.parent !== w.floating) {
          const global = view.getGlobalPosition();
          w.hand.remove(view);
          w.floating.addChild(view);
          const local = w.floating.toLocal(global);
          view.position.set(local.x, local.y);
        }
        view.setShadow(0);
        this.inPlay = view;
        audio().play('card-play');
        w.hand.layout();
        gsap.killTweensOf(view);
        gsap.killTweensOf(view.scale);
        const c = w.positions.center;
        await Promise.all([
          done(gsap.to(view, { x: c.x, y: c.y, rotation: 0, duration: d(0.16), ease: 'power2.out' })),
          done(gsap.to(view.scale, { x: 0.9, y: 0.9, duration: d(0.16), ease: 'power2.out' })),
        ]);
        if (spatial()) await done(gsap.fromTo(view.scale, { x: 0.86, y: 0.86 }, { x: 0.9, y: 0.9, duration: d(0.1), ease: 'back.out(3)' }));
        return;
      }
      case 'cardMoved': {
        const inPlay = this.inPlay?.cardUid === ev.uid ? this.inPlay : null;
        const view = inPlay ?? this.findView(ev.uid);
        if (ev.to === 'hand') {
          if (view) return;
          const fresh = w.makeCardView(ev.uid);
          if (!fresh) return;
          fresh.position.set(w.positions.center.x - w.hand.x, w.positions.center.y - w.hand.y);
          fresh.scale.set(0.5);
          w.hand.add(fresh);
          w.hand.layout();
          await wait(d(0.2));
          return;
        }
        if (ev.to === 'draw') {
          this.counts.draw++;
          this.showCounts();
          return;
        }
        if (ev.to === 'discard') this.counts.discard++;
        if (ev.to === 'exhaust') this.counts.exhaust++;
        if (!view) {
          this.showCounts();
          return;
        }
        if (inPlay) this.inPlay = null;
        else w.hand.remove(view);
        if (view.parent !== w.floating) {
          const global = view.getGlobalPosition();
          view.parent?.removeChild(view);
          w.floating.addChild(view);
          const local = w.floating.toLocal(global);
          view.position.set(local.x, local.y);
        }
        w.hand.layout();
        gsap.killTweensOf(view);
        gsap.killTweensOf(view.scale);
        const finish = () => {
          view.destroy({ children: true });
          this.showCounts();
        };
        audio().play(ev.to === 'exhaust' ? 'card-exhaust' : 'card-discard', { volume: 0.6 });
        if (ev.to === 'exhaust') {
          const p = w.positions.exhaust;
          const tl = gsap.timeline({ onComplete: finish });
          tl.to(view.scale, { x: 1.05, y: 1.05, duration: d(0.12) }, 0)
            .to(view, { alpha: 0, duration: d(0.35), ease: 'power2.in' }, d(0.08))
            .to(view, { x: p.x, y: p.y - CARD_H * 0.2, duration: d(0.4), ease: 'power2.in' }, d(0.05))
            .to(view.scale, { x: 0.2, y: 0.2, duration: d(0.4), ease: 'power2.in' }, d(0.05));
          if (!inCascade) await done(tl);
          return;
        }
        if (ev.to === 'powers' || ev.to === 'gone') {
          const p = w.positions.powers;
          const tl = gsap.timeline({ onComplete: finish });
          tl.to(view, { x: p.x, y: p.y, alpha: 0.2, duration: d(0.35), ease: 'power2.in' }, 0)
            .to(view.scale, { x: 0.15, y: 0.15, duration: d(0.35), ease: 'power2.in' }, 0);
          if (!inCascade) await done(tl);
          return;
        }
        const p = w.positions.discard;
        const tl = gsap.timeline({ onComplete: finish });
        tl.to(view, { x: p.x, y: p.y, rotation: 0.35, duration: d(0.26), ease: 'power2.in' }, 0)
          .to(view.scale, { x: 0.3, y: 0.3, duration: d(0.26), ease: 'power2.in' }, 0);
        if (!inCascade) await done(tl);
        return;
      }
      case 'damage': {
        const hpDamage = ev.amount - ev.blocked;
        const intensity = hitIntensity(hpDamage, ev.blocked);
        if (ev.target === 'hero') {
          this.blocks.set('hero', Math.max(0, this.block('hero') - ev.blocked));
          w.player.hp.set(ev.hp, w.state.hero.maxHp, this.block('hero'));
          audio().play(hpDamage > 0 ? 'hero-hurt' : 'hit-blocked');
          w.shakeScreen(intensity);
          w.screenFlash(ev.kind, intensity);
          await w.player.hit(ev.amount, ev.blocked, hpDamage);
        } else {
          const e = w.enemies.get(ev.target);
          if (!e) return;
          this.blocks.set(ev.target, Math.max(0, this.block(ev.target) - ev.blocked));
          e.hp.set(ev.hp, e.hp.maximum, this.block(ev.target));
          audio().play(hpDamage <= 0 ? 'hit-blocked' : hpDamage >= 12 ? 'hit-heavy' : 'hit-light');
          if (ev.killed) await w.slowMo();
          w.shakeScreen(intensity * 0.8);
          await e.hit(ev.amount, ev.blocked, hpDamage);
        }
        return;
      }
      case 'negated': {
        const label = ev.by === 'images' ? 'Image!' : ev.by === 'trap' ? 'Trapped!' : 'Intangible';
        if (ev.target === 'hero') w.player.negated(label);
        else w.enemies.get(ev.target)?.negated(label);
        await wait(d(0.2));
        return;
      }
      case 'block': {
        this.blocks.set(ev.target, ev.total);
        if (ev.amount > 0) audio().play('block');
        if (ev.target === 'hero') {
          w.player.hp.setBlock(ev.total);
          w.player.blockGain(ev.amount);
        } else {
          const e = w.enemies.get(ev.target);
          e?.setBlock(ev.total);
          if (e && ev.amount > 0) void floatNumber(w.fx, e.x, e.y - 200, `+${ev.amount}`, 'block');
        }
        if (ev.amount > 0) await wait(d(0.18));
        return;
      }
      case 'status': {
        if (ev.target === 'hero') w.player.statuses.set(ev.status, ev.total);
        else {
          const e = w.enemies.get(ev.target);
          if (!e) return;
          e.statuses.set(ev.status, ev.total);
          if (ev.delta > 0 && (ev.status === 'strength' || ev.status === 'ritual' || ev.status === 'regen')) e.buff();
        }
        if (ev.delta > 0) {
          audio().play(DEBUFFS.includes(ev.status) ? 'debuff' : 'buff', { volume: 0.7 });
          await wait(d(0.14));
        }
        return;
      }
      case 'heal': {
        if (ev.amount > 0) audio().play('heal');
        if (ev.target === 'hero') {
          w.player.hp.set(ev.hp, w.state.hero.maxHp, this.block('hero'));
          if (ev.amount > 0) w.player.heal(ev.amount);
        } else {
          const e = w.enemies.get(ev.target);
          if (!e) return;
          e.hp.set(ev.hp, e.hp.maximum, this.block(ev.target));
          if (ev.amount > 0) void floatNumber(w.fx, e.x, e.y - 200, `+${ev.amount}`, 'heal');
        }
        if (ev.amount > 0) await wait(d(0.2));
        return;
      }
      case 'energy':
        w.player.setEnergy(ev.total, w.state.hero.maxEnergy);
        return;
      case 'resource': {
        if (w.resource && w.resource.resource === ev.name) w.resource.set(ev.total);
        if (ev.delta !== 0) await wait(d(0.12));
        return;
      }
      case 'companion': {
        const c = w.companion;
        if (!c) return;
        if (ev.action === 'act') await c.act();
        else if (ev.action === 'enrage') c.enrage();
        else if (ev.action === 'stun') c.stun(true);
        else if (ev.action === 'unstun') c.stun(false);
        else if (ev.action === 'feed') c.feed(w.state.hero.companion?.bonus ?? 0);
        if (ev.action !== 'act') await wait(d(0.15));
        return;
      }
      case 'trap': {
        if (ev.state === 'armed') w.traps.arm(ev.uid, ev.cardId);
        else if (ev.state === 'fired') await w.traps.fire(ev.uid);
        else w.traps.remove(ev.uid);
        if (ev.state === 'armed') await wait(d(0.15));
        return;
      }
      case 'gold':
        audio().play('gold');
        void floatNumber(w.fx, w.player.x, w.player.y - 80, `${ev.delta > 0 ? '+' : ''}${ev.delta} gold`, 'status');
        await wait(d(0.1));
        return;
      case 'power':
        if (ev.state === 'added') {
          void floatNumber(w.fx, w.player.x, w.player.y - 80, w.content.cards[ev.cardId]?.name ?? 'Power', 'status');
          await wait(d(0.15));
        }
        return;
      case 'prompt':
        return;
      case 'vial':
        void floatNumber(w.fx, w.player.x, w.player.y - 80, w.content.vials?.[ev.id]?.name ?? 'Vial', 'status');
        await wait(d(0.2));
        return;
      case 'die': {
        if (ev.target === 'hero') return;
        const e = w.enemies.get(ev.target);
        if (!e) return;
        audio().play('enemy-die');
        await e.die();
        w.enemies.delete(ev.target);
        e.destroy({ children: true });
        w.layoutEnemies();
        return;
      }
      case 'intent': {
        w.enemies.get(ev.enemy)?.setIntent({ move: '', kind: ev.kind, hidden: ev.hidden, damage: ev.damage, hits: ev.hits, block: ev.block });
        return;
      }
      case 'enemyAct': {
        const e = w.enemies.get(ev.enemy);
        if (!e) return;
        if (ev.skipped) {
          const label = ev.skipped === 'stun' ? 'Stunned' : ev.skipped === 'frozen' ? 'Frozen' : ev.skipped === 'wait' ? 'Waiting' : 'Countered';
          void floatNumber(w.fx, e.x, e.y - 220, label, 'negated');
          await wait(d(0.45));
          return;
        }
        const kind = w.state.enemies.find((x) => x.id === ev.enemy)?.history.length ? null : null;
        void kind;
        const move = w.content.enemies[w.state.enemies.find((x) => x.id === ev.enemy)?.enemyId ?? '']?.moves[ev.move];
        e.setIntent(null);
        if (move?.intent === 'attack') {
          audio().play('enemy-attack');
          await e.attack();
        }
        else {
          e.buff();
          await wait(d(0.25));
        }
        return;
      }
      case 'summon': {
        const view = w.addEnemy(ev.enemy);
        if (!view) return;
        view.alpha = 0;
        view.scale.set(0.6);
        w.layoutEnemies();
        await Promise.all([done(gsap.to(view, { alpha: 1, duration: d(0.3) })), done(gsap.to(view.scale, { x: 1, y: 1, duration: d(0.3), ease: 'back.out(2)' }))]);
        return;
      }
      case 'phase': {
        const e = w.enemies.get(ev.enemy);
        if (e) void floatNumber(w.fx, e.x, e.y - 240, 'Enraged!', 'status', true);
        await wait(d(0.3));
        return;
      }
      case 'end':
        await wait(d(0.3));
        audio().play(ev.result === 'won' ? 'victory' : 'defeat');
        await w.banner(ev.result === 'won' ? 'VICTORY' : 'DEFEAT');
        w.onEnd(ev.result);
        return;
    }
  }

  /** Pile counts and energy from state: the safety net after a batch has fully played. */
  syncCounts(): void {
    const w = this.w;
    this.counts = { draw: w.state.piles.draw.length, discard: w.state.piles.discard.length, exhaust: w.state.piles.exhaust.length };
    this.showCounts();
    w.player.setEnergy(w.state.hero.energy, w.state.hero.maxEnergy);
  }

  /** Seed the trackers from state at fight start or resume. */
  reset(): void {
    this.blocks.clear();
    this.blocks.set('hero', this.w.state.hero.block);
    for (const e of this.w.state.enemies) this.blocks.set(e.id, e.block);
    this.inPlay = null;
    // At fight start the engine has already drawn; the draw events will count down from the full deck.
    const total = this.w.state.piles.draw.length + this.w.state.piles.hand.length;
    this.counts = { draw: total, discard: 0, exhaust: 0 };
    this.showCounts();
  }
}

function wait(seconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}
