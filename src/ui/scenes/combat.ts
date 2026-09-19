import { Container, Graphics, type Texture } from 'pixi.js';
import gsap from 'gsap';
import { loadBackground, loadCardArtFor, loadEnemyArtFor, type EnemyTextures } from '../../app/art';
import { audio } from '../../app/audio';
import { DESIGN } from '../../app/fit';
import { markTutorial } from '../../app/tutorial';
import type { Scene, SceneContext } from '../../app/router';
import type { DamageKind } from '../../engine/events';
import type { Card } from '../../content/schema';
import {
  cardOf, costOf, createCombat, describeResolved, drainEvents, endTurn, explainCard, legalPlays, playCard, respondPrompt, useVial,
  type CombatState, type Content, type EncounterSetup, type HeroSetup, type Unplayable,
} from '../../engine/rules';
import { CARD_H, CARD_W, CardView, type CardDisplay } from '../cards/CardView';
import { DragController } from '../cards/DragController';
import { HandLayout } from '../cards/HandLayout';
import { PileView } from '../cards/PileView';
import { CombatBar } from '../combat/CombatBar';
import { CompanionView } from '../combat/CompanionView';
import { EnemyView } from '../combat/EnemyView';
import { Playback, type World } from '../combat/Playback';
import { PlayerPanel } from '../combat/PlayerPanel';
import { ResourceWidget } from '../combat/ResourceWidget';
import { TrapRow } from '../combat/TrapRow';
import { backdrop } from '../kit/backdrop';
import { ParallaxBackdrop } from '../kit/parallax';
import { Button } from '../kit/button';
import { Coach } from '../kit/coach';
import { vignetteSprite } from '../fx/vignette';
import { Explainer } from '../kit/explainer';
import { d, done, spatial } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { Tooltip } from '../kit/tooltip';

export interface CombatSetup {
  hero: HeroSetup;
  encounter: EncounterSetup;
  seed: string;
  /** Background key in the art manifest; defaults to chapter1. */
  background?: string;
  /** An existing fight to continue (a saved run). `hero`/`encounter`/`seed` are ignored. */
  resume?: CombatState;
  /** After every engine step; the run layer saves here. */
  onStep?: (state: CombatState) => void;
  /** Called when the fight ends; the run layer routes onward. Returns the buttons to show, or nothing for the dev overlay. */
  onEnd?: (result: 'won' | 'lost', state: CombatState) => void;
  /** Hide the dev "Again / Title" overlay and let onEnd take over. */
  quietEnd?: boolean;
  /** Run the guided first-fight walkthrough (the run does this once per browser). */
  tips?: boolean;
}

const LAYOUT = {
  enemyBaseY: 640,
  enemyCenterX: 1330,
  player: { x: 250, y: 420 },
  hand: { centerX: 960, baseY: 945, scale: 0.8, hoverScale: 1.15, maxSpread: 1000 },
  aimSpot: { x: 960, y: 790 },
  draw: { x: 110, y: 960 },
  discard: { x: 1810, y: 960 },
  exhaust: { x: 1690, y: 985 },
  endTurn: { x: 1760, y: 830 },
  playLineY: 730,
  center: { x: 960, y: 520 },
  powers: { x: 250, y: 660 },
};

const REASONS: Record<Unplayable, string> = {
  'not-your-turn': 'Not your turn.',
  'prompt-open': 'Finish choosing first.',
  resolving: 'Wait for the card to resolve.',
  'not-in-hand': '',
  unplayable: 'This card cannot be played.',
  bound: 'Bound: take damage to free it.',
  energy: 'Not enough energy.',
  'needs-target': 'Drag it onto an enemy.',
  'bad-target': 'Not a valid target.',
  condition: 'Its condition is not met.',
};

/** The table. One fight, start to finish. */
export function combatScene(ctx: SceneContext, content: Content, setup: CombatSetup): Scene {
  const view = new Container({ label: 'combat' });
  let state: CombatState;
  let busy = true;
  let promptSelection: number[] = [];

  const tooltip = new Tooltip();
  const explainer = new Explainer(content, ctx.stage);
  const layers = {
    bg: new Container({ label: 'bg' }),
    table: new Container({ label: 'table' }),
    enemies: new Container({ label: 'enemies' }),
    hand: null as unknown as HandLayout,
    floating: new Container({ label: 'floating' }),
    fx: new Container({ label: 'fx' }),
    ui: new Container({ label: 'ui' }),
    /** Full-screen flashes; above the table, not shaken, under banners. */
    screenFx: new Container({ label: 'screen-fx' }),
    overlay: new Container({ label: 'combat-overlay' }),
  };
  const enemies = new Map<string, EnemyView>();
  let player: PlayerPanel;
  let resource: ResourceWidget | null = null;
  let companion: CompanionView | null = null;
  let traps: TrapRow;
  let bar: CombatBar;
  let piles: World['piles'];
  let playback: Playback;
  let drag: DragController;
  let endTurnBtn: Button;
  let promptBar: Container | null = null;
  let coach: Coach | null = null;
  const shakeRoot = new Container({ label: 'shake' });
  const vignette = vignetteSprite();
  let enemyArt = new Map<string, EnemyTextures>();
  let cardArt = new Map<string, Texture>();

  function display(uid: number): CardDisplay | null {
    const inst = [...state.piles.hand, ...state.piles.draw, ...state.piles.discard, ...state.piles.exhaust, ...(state.inPlay ? [state.inPlay] : [])].find((c) => c.uid === uid);
    if (!inst) return null;
    const resolved = cardOf(content, inst);
    const inHand = state.piles.hand.includes(inst);
    const cost = resolved.cost === 'X' ? ('X' as const) : { value: inHand ? costOf(state, inst, resolved) : resolved.cost, base: resolved.cost };
    return { resolved, segments: describeResolved(resolved, { state }), cost, art: cardArt.get(inst.cardId) ?? null };
  }

  function cardDef(uid: number): Card | null {
    const inst = [...state.piles.hand, ...state.piles.draw, ...state.piles.discard, ...state.piles.exhaust, ...(state.inPlay ? [state.inPlay] : [])].find((c) => c.uid === uid);
    return inst ? (content.cards[inst.cardId] ?? null) : null;
  }

  function makeCardView(uid: number): CardView | null {
    const def = cardDef(uid);
    const disp = display(uid);
    if (!def || !disp) return null;
    const cv = new CardView(uid, def, disp);
    drag.attach(cv);
    return cv;
  }

  /** Re-render hand texts (live numbers) and glow the playable ones. */
  function refreshHand(): void {
    bar?.sync(state.hero);
    const legal = new Set(legalPlays(state, content).map((p) => p.uid));
    for (const cv of layers.hand.cards) {
      const disp = display(cv.cardUid);
      if (disp) cv.refresh(disp);
      cv.setGlow(!busy && !state.prompt && legal.has(cv.cardUid));
    }
    endTurnBtn.alpha = busy ? 0.5 : 1;
    // Nothing left to do this turn: point at End Turn.
    endTurnBtn.setGlow(!busy && !state.prompt && state.phase === 'player' && (state.hero.energy === 0 || legal.size === 0));
    if (state.hero.energy === 0) coach?.notify('energy-zero');
  }

  function layoutEnemies(): void {
    const alive = state.enemies.filter((e) => e.alive && enemies.has(e.id));
    const widths = alive.map((e) => ({ small: 220, medium: 300, large: 380 })[content.enemies[e.enemyId]!.size]);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = LAYOUT.enemyCenterX - total / 2;
    alive.forEach((e, i) => {
      const v = enemies.get(e.id)!;
      const cx = x + widths[i]! / 2;
      x += widths[i]!;
      gsap.to(v, { x: cx, y: LAYOUT.enemyBaseY, duration: d(0.3), ease: 'power2.out' });
    });
  }

  function addEnemy(id: string): EnemyView | null {
    const inst = state.enemies.find((e) => e.id === id);
    if (!inst) return null;
    const def = content.enemies[inst.enemyId]!;
    const v = new EnemyView(inst, def, enemyArt.get(inst.enemyId) ?? null, explainer, layers.fx);
    v.position.set(LAYOUT.enemyCenterX, LAYOUT.enemyBaseY);
    enemies.set(id, v);
    layers.enemies.addChild(v);
    v.body.on('pointerover', () => {
      if (!drag.isDragging) v.setHighlight(true);
    });
    v.body.on('pointerout', () => {
      if (!drag.isDragging) v.setHighlight(false);
    });
    v.body.on('rightclick', () => showMoves(id));
    v.body.on('pointertap', () => drinkOn(id));
    return v;
  }

  /** Right-click an enemy: the moves it has shown so far, with their numbers. */
  function showMoves(id: string): void {
    const inst = state.enemies.find((e) => e.id === id);
    if (!inst) return;
    const def = content.enemies[inst.enemyId]!;
    const seen = [...new Set(inst.history)];
    const overlay = new Container();
    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.6 });
    dim.eventMode = 'static';
    dim.on('pointertap', () => overlay.destroy({ children: true }));
    dim.on('rightclick', () => overlay.destroy({ children: true }));
    overlay.addChild(dim);
    const panel = new Graphics();
    panel.roundRect(0, 0, 640, 120 + Math.max(1, seen.length) * 44, 16).fill({ color: 0x14121c, alpha: 0.97 }).stroke({ color: PALETTE.gold, width: 2 });
    panel.position.set(DESIGN.width / 2 - 320, 300);
    overlay.addChild(panel);
    const title = makeText(def.name.toUpperCase(), { ...STYLE.display(30), fill: PALETTE.gold });
    title.position.set(panel.x + 28, panel.y + 22);
    overlay.addChild(title);
    const artist = enemies.get(id)?.artist;
    const credit = artist ? content.credits?.[artist]?.name ?? artist : null;
    const sub = makeText(`${def.tags.join(' · ')} · moves seen ${seen.length} of ${Object.keys(def.moves).length}${credit ? ` · drawn by ${credit}` : ''}`, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
    sub.position.set(panel.x + 28, panel.y + 66);
    overlay.addChild(sub);
    const lines = seen.length ? seen : ['—'];
    lines.forEach((m, i) => {
      const move = def.moves[m];
      const name = move?.name ?? m.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
      const kind = move ? move.intent : '';
      const text = makeText(`${name}${kind ? `  ·  ${kind}` : ''}`, STYLE.body(24));
      text.position.set(panel.x + 28, panel.y + 100 + i * 44);
      overlay.addChild(text);
    });
    layers.overlay.addChild(overlay);
  }

  async function banner(text: string, sub?: string): Promise<void> {
    if (!text && !sub) return;
    const c = new Container();
    const bg = new Graphics();
    bg.rect(0, -50, DESIGN.width, 100).fill({ color: 0x000000, alpha: text ? 0.55 : 0.25 });
    c.addChild(bg);
    if (text) {
      const t = makeText(text, { ...STYLE.display(64), fill: PALETTE.gold, letterSpacing: 8 });
      t.anchor.set(0.5);
      c.addChild(t);
    }
    if (sub) {
      const s = makeText(sub, { ...STYLE.mono(20), fill: PALETTE.parchmentDim });
      s.anchor.set(0.5);
      s.position.set(0, text ? 46 : 0);
      c.addChild(s);
    }
    c.position.set(DESIGN.width / 2, LAYOUT.center.y - 60);
    c.alpha = 0;
    layers.overlay.addChild(c);
    const tl = gsap.timeline({ onComplete: () => c.destroy({ children: true }) });
    tl.to(c, { alpha: 1, duration: d(0.12) }).to(c, { alpha: 0, duration: d(0.2) }, text ? d(0.38) : d(0.25));
    await done(tl);
  }

  /** Rattle the whole table; `intensity` 0..1 sets how far and how long. */
  function shakeScreen(intensity: number): void {
    if (!spatial() || !ctx.settings.get().shake || intensity <= 0) return;
    const px = 3 + 18 * intensity;
    const n = 3 + Math.round(4 * intensity);
    gsap.killTweensOf(shakeRoot);
    const tl = gsap.timeline({ onComplete: () => shakeRoot.position.set(0, 0) });
    for (let i = 0; i < n; i++) {
      const s = px * (1 - i / n);
      tl.to(shakeRoot, { x: (Math.random() - 0.5) * 2 * s, y: (Math.random() - 0.5) * 1.4 * s, duration: d(0.035) });
    }
    tl.to(shakeRoot, { x: 0, y: 0, duration: d(0.05) });
  }

  const FLASH_COLOR: Record<DamageKind, number> = { attack: 0xc8102e, poison: 0x6fbf3f, effect: PALETTE.ember };

  /** The hero was hit: a diffuse flash from the edges, coloured by what hit them. */
  function screenFlash(kind: DamageKind, intensity: number): void {
    if (intensity <= 0) return;
    vignette.tint = FLASH_COLOR[kind];
    gsap.killTweensOf(vignette);
    vignette.alpha = 0.3 + 0.55 * intensity;
    gsap.to(vignette, { alpha: 0, duration: Math.max(0.2, d(0.3 + 0.5 * intensity)), ease: 'power2.out' });
  }

  async function slowMo(): Promise<void> {
    if (!spatial()) return;
    gsap.globalTimeline.timeScale(0.25);
    await new Promise((r) => setTimeout(r, 90));
    gsap.globalTimeline.timeScale(1);
  }

  /** Run an engine action, then play what it produced. */
  async function act(fn: () => void): Promise<void> {
    if (busy) return;
    busy = true;
    refreshHand();
    const turnBefore = state.turn;
    fn();
    const events = drainEvents(state);
    setup.onStep?.(state);
    await playback.play(events);
    busy = false;
    if (state.turn > turnBefore) coach?.notify('hero-turn');
    if (state.phase === 'won' || state.phase === 'lost') {
      busy = true;
      return;
    }
    if (state.prompt) showPrompt();
    refreshHand();
  }

  function showPrompt(): void {
    const p = state.prompt!;
    promptSelection = [];
    promptBar = new Container();
    const bg = new Graphics();
    bg.roundRect(-360, -34, 720, 68, 12).fill({ color: 0x000000, alpha: 0.7 }).stroke({ color: PALETTE.gold, width: 2 });
    promptBar.addChild(bg);
    const label = makeText(`Choose ${p.count} card${p.count > 1 ? 's' : ''} to ${p.kind}`, { ...STYLE.display(24), fill: PALETTE.gold });
    label.anchor.set(0, 0.5);
    label.position.set(-330, 0);
    promptBar.addChild(label);
    const confirm = new Button({
      label: 'Confirm',
      width: 180,
      height: 48,
      onPress: () => {
        if (promptSelection.length !== p.count) return;
        const chosen = [...promptSelection];
        promptBar?.destroy({ children: true });
        promptBar = null;
        void act(() => respondPrompt(state, content, chosen));
      },
    });
    confirm.position.set(250, 0);
    confirm.alpha = 0.5;
    promptBar.addChild(confirm);
    promptBar.position.set(DESIGN.width / 2, LAYOUT.playLineY + 30);
    layers.ui.addChild(promptBar);
    for (const cv of layers.hand.cards) {
      cv.removeAllListeners('pointertap');
      cv.on('pointertap', () => {
        if (!state.prompt) return;
        const i = promptSelection.indexOf(cv.cardUid);
        if (i >= 0) promptSelection.splice(i, 1);
        else if (promptSelection.length < p.count) promptSelection.push(cv.cardUid);
        for (const c of layers.hand.cards) c.setGlow(promptSelection.includes(c.cardUid));
        confirm.alpha = promptSelection.length === p.count ? 1 : 0.5;
      });
    }
  }

  function showInspector(uid: number): void {
    const def = cardDef(uid);
    const disp = display(uid);
    if (!def || !disp) return;
    const overlay = new Container();
    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.7 });
    dim.eventMode = 'static';
    const close = () => {
      dim.eventMode = 'none';
      explainer.hide();
      gsap.to(overlay, { alpha: 0, duration: d(0.12), onComplete: () => overlay.destroy({ children: true }) });
    };
    dim.on('pointertap', close);
    overlay.addChild(dim);
    const big = new CardView(uid, def, disp);
    big.position.set(DESIGN.width / 2 - 200, DESIGN.height / 2);
    big.eventMode = 'none';
    overlay.addChild(big);
    // Grow in from a little smaller, over the fading dim: one motion, not a lift and a drop.
    overlay.alpha = 0;
    gsap.to(overlay, { alpha: 1, duration: d(0.15) });
    gsap.fromTo(big.scale, { x: 1.9, y: 1.9 }, { x: 2.2, y: 2.2, duration: d(0.2), ease: 'power2.out' });
    // Its words, explained beside it; the same column a hover shows.
    const ex = explainCard(content, disp.resolved, { state });
    if (ex.notes.length) explainer.showAt({ x: DESIGN.width / 2 - 200 - CARD_W * 1.1, y: DESIGN.height / 2 - CARD_H * 1.1, w: CARD_W * 2.2, h: CARD_H * 2.2 }, ex, { header: false, delayMs: 0 });
    else {
      const none = makeText('Nothing here needs explaining.', { ...STYLE.body(22), fill: PALETTE.parchmentDim });
      none.position.set(DESIGN.width / 2 + 120, DESIGN.height / 2 - 20);
      overlay.addChild(none);
    }
    const hint = makeText('tap or click anywhere to close', STYLE.mono(16));
    hint.alpha = 0.6;
    hint.anchor.set(0.5);
    hint.position.set(DESIGN.width / 2, DESIGN.height - 60);
    overlay.addChild(hint);
    layers.overlay.addChild(overlay);
  }

  function doEndTurn(): void {
    if (busy || state.prompt) return;
    coach?.notify('end-turn');
    audio().play('turn-end');
    void act(() => endTurn(state, content));
  }

  /**
   * The first-fight walkthrough. Each step waits for the player to do the
   * thing it describes; the chevrons follow the card, the orb, the enemy.
   */
  function startCoach(): void {
    const firstCard = (targeted: boolean) => {
      const legal = new Set(legalPlays(state, content).map((p) => p.uid));
      const cv = layers.hand.cards.find((c) => legal.has(c.cardUid) && (cardDef(c.cardUid)?.target === 'enemy') === targeted);
      return cv ? { x: layers.hand.x + cv.x, y: layers.hand.y + cv.y - (CARD_H * cv.scale.y) / 2 } : null;
    };
    const firstEnemy = () => [...enemies.values()].find((v) => !v.dead) ?? null;
    const orbTop = { x: LAYOUT.player.x - 130, y: LAYOUT.player.y + 230 - 58 };
    const endTurnTop = { x: LAYOUT.endTurn.x, y: LAYOUT.endTurn.y - 36 };
    coach = new Coach(ctx.stage, [
      {
        title: 'Attack',
        text: 'Attack cards need a target. Drag the glowing card onto an enemy and let go.',
        until: ['play-targeted'],
        point: () => [firstCard(true), firstEnemy()?.top ?? null],
      },
      {
        title: 'Energy',
        text: 'Every card costs energy: the number in its corner. The orb shows what you have left this turn; it refills every turn. Skills need no target. Drag one straight up, past the line.',
        until: ['play-untargeted', 'energy-zero'],
        point: () => [orbTop, firstCard(false)],
      },
      {
        title: 'What the enemy will do',
        text: 'The badge above an enemy is its next move. A sword means an attack, and the number is the damage it will deal. Block from your skills soaks damage before it reaches your health, and lasts until your next turn.',
        point: () => [firstEnemy()?.top ?? null],
      },
      {
        title: 'The words in gold',
        text: 'Anything written in gold has a meaning you can check. Rest the pointer on a card, a badge or a status for a moment (tap it on a touch screen) and its words are explained beside it.',
        until: ['explain'],
        point: () => [firstCard(false) ?? firstCard(true), firstEnemy()?.top ?? null],
      },
      {
        title: 'End your turn',
        text: 'Out of energy, or out of moves? Press End Turn. Cards you did not play go to the discard pile.',
        until: ['end-turn'],
        point: () => [endTurnTop],
      },
      {
        title: 'Your turn again',
        text: 'A new hand of five and full energy, every turn. When the draw pile runs out, the discard pile shuffles back in. Hover anything for details. Right-click an enemy to see the moves it has shown. Now win this fight.',
        after: 'hero-turn',
      },
    ], { x: 60, y: 64 }, () => {
      markTutorial('fight');
      coach = null;
    });
    layers.overlay.addChild(coach);
    coach.start();
  }

  function endFight(result: 'won' | 'lost'): void {
    setup.onStep?.(state);
    if (setup.quietEnd) {
      setup.onEnd?.(result, state);
      return;
    }
    const overlay = new Container();
    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.6 });
    overlay.addChild(dim);
    const t = makeText(result === 'won' ? 'VICTORY' : 'DEFEAT', { ...STYLE.display(96), fill: PALETTE.gold, letterSpacing: 10 });
    t.anchor.set(0.5);
    t.position.set(DESIGN.width / 2, 400);
    overlay.addChild(t);
    const again = new Button({ label: 'Again', onPress: () => ctx.router.go('/dev/fight', { seed: `${setup.seed}-${Date.now() % 1000}`, class: setup.hero.classId, enemies: setup.encounter.enemies.join(',') }) });
    again.position.set(DESIGN.width / 2, 560);
    const back = new Button({ label: 'Title', variant: 'ghost', onPress: () => ctx.router.go('/') });
    back.position.set(DESIGN.width / 2, 660);
    overlay.addChild(again, back);
    overlay.alpha = 0;
    layers.overlay.addChild(overlay);
    gsap.to(overlay, { alpha: 1, duration: d(0.4) });
    setup.onEnd?.(result, state);
  }

  let fpsText: ReturnType<typeof makeText> | null = null;
  function toggleFps(): void {
    if (fpsText) {
      ctx.stage.app.ticker.remove(fpsTick);
      fpsText.destroy();
      fpsText = null;
      return;
    }
    fpsText = makeText('', { ...STYLE.mono(22), fill: PALETTE.goldBright });
    fpsText.position.set(24, 24);
    layers.overlay.addChild(fpsText);
    ctx.stage.app.ticker.add(fpsTick);
  }
  let worst = 0;
  function fpsTick(): void {
    if (!fpsText) return;
    const t = ctx.stage.app.ticker;
    worst = Math.max(worst * 0.97, t.deltaMS);
    fpsText.text = `${t.FPS.toFixed(0)} fps · ${t.deltaMS.toFixed(1)} ms · worst ${worst.toFixed(1)} · hand ${layers.hand.cards.length} · enemies ${enemies.size}`;
  }

  /** Keyboard target: index into the living enemies, shown as the ground ring. */
  let keyTarget = 0;
  function keyTargetId(): string | undefined {
    const alive = state.enemies.filter((x) => x.alive);
    if (!alive.length) return undefined;
    keyTarget = ((keyTarget % alive.length) + alive.length) % alive.length;
    return alive[keyTarget]!.id;
  }
  function showKeyTarget(): void {
    const id = keyTargetId();
    for (const [eid, v] of enemies) v.setHighlight(eid === id);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'f' || e.key === 'F') toggleFps();
    if (e.key === 'Escape') {
      layers.hand.setHover(null);
      bar.selectedVial = null;
      bar.sync(state.hero);
      for (const v of enemies.values()) v.setHighlight(false);
    }
    if (busy || state.prompt) return;
    if (e.key === 'e' || e.key === 'E') doEndTurn();
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const cv = layers.hand.cards[n - 1];
      if (cv) layers.hand.setHover(cv);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyTarget += e.key === 'ArrowLeft' ? -1 : 1;
      showKeyTarget();
    }
    if (e.key === 'Enter' && layers.hand.hovered) {
      const uid = layers.hand.hovered.cardUid;
      const targeted = content.cards[layers.hand.hovered.card.id]!.target === 'enemy';
      void tryPlay(uid, targeted ? keyTargetId() : undefined);
      for (const v of enemies.values()) v.setHighlight(false);
    }
  }

  /** A vial: drink it, or arm it and wait for an enemy click. */
  function onVial(index: number): void {
    if (busy || state.prompt) return;
    const id = state.hero.vials[index];
    const vial = id ? content.vials?.[id] : undefined;
    if (!vial) return;
    if (vial.target === 'enemy') {
      bar.selectedVial = bar.selectedVial === index ? null : index;
      bar.sync(state.hero);
      for (const v of enemies.values()) v.setHighlight(bar.selectedVial !== null);
      return;
    }
    void act(() => useVial(state, content, index));
    bar.selectedVial = null;
  }

  function drinkOn(enemyId: string): boolean {
    if (bar.selectedVial === null) return false;
    const index = bar.selectedVial;
    bar.selectedVial = null;
    for (const v of enemies.values()) v.setHighlight(false);
    void act(() => useVial(state, content, index, enemyId));
    return true;
  }

  function tryPlay(uid: number, targetId?: string): boolean {
    const r = playCard(state, content, uid, targetId);
    if (!r.ok) {
      if (r.reason === 'energy') player.refuseEnergy();
      const msg = REASONS[r.reason];
      if (msg) {
        const p = layers.hand.find(uid)?.getGlobalPosition();
        const local = p ? tooltip.parent!.toLocal(p) : { x: 960, y: 800 };
        tooltip.show('', msg, local.x, local.y - 60, 0);
        setTimeout(() => tooltip.hide(), 1200);
      }
      return false;
    }
    // The engine has already run; play it back.
    coach?.notify(targetId ? 'play-targeted' : 'play-untargeted');
    busy = true;
    refreshHand();
    const events = drainEvents(state);
    setup.onStep?.(state);
    void playback.play(events).then(() => {
      busy = false;
      if (state.phase === 'won' || state.phase === 'lost') {
        busy = true;
        return;
      }
      if (state.prompt) showPrompt();
      refreshHand();
    });
    return true;
  }

  return {
    view,
    async enter() {
      const resumed = !!setup.resume;
      state = setup.resume ?? createCombat(content, setup.hero, setup.encounter, setup.seed);
      // Art for this fight only: the enemies in it and the cards in the deck.
      const deckIds = [...state.piles.draw, ...state.piles.hand, ...state.piles.discard].map((c) => c.cardId);
      const [ea, ca, bg] = await Promise.all([loadEnemyArtFor(state.enemies.map((e) => e.enemyId)), loadCardArtFor(deckIds), loadBackground(setup.background ?? 'chapter1')]);
      enemyArt = ea;
      cardArt = ca;

      view.addChild(shakeRoot);
      shakeRoot.addChild(layers.bg, layers.table, layers.enemies);
      layers.bg.addChild(bg ? new ParallaxBackdrop(bg, ctx.stage) : backdrop(0x161a24, 0x0b0a0f));
      const floor = new Graphics();
      floor.ellipse(LAYOUT.enemyCenterX, LAYOUT.enemyBaseY + 10, 520, 60).fill({ color: 0x000000, alpha: 0.25 });
      layers.table.addChild(floor);

      layers.hand = new HandLayout(LAYOUT.hand);
      shakeRoot.addChild(layers.hand, layers.floating, layers.fx, layers.ui);
      view.addChild(layers.screenFx, layers.overlay);
      layers.screenFx.addChild(vignette);
      ctx.stage.overlay.addChild(tooltip, explainer);
      explainer.onShow = () => coach?.notify('explain');
      // The lifted card explains its words beside it, after the hover delay.
      layers.hand.onHover = (cv) => {
        if (!cv) {
          explainer.hide();
          return;
        }
        const disp = display(cv.cardUid);
        if (disp) explainer.show(cv, explainCard(content, disp.resolved, { state }), { header: false });
      };

      player = new PlayerPanel(state.hero, explainer, layers.fx);
      player.position.set(LAYOUT.player.x, LAYOUT.player.y);
      player.energyOrb.position.set(-130, 230);
      layers.ui.addChild(player);

      const classDef = content.classes?.[state.hero.classId];
      if (classDef?.resource) {
        resource = new ResourceWidget(classDef.resource, explainer);
        resource.set(state.hero.resources[classDef.resource]);
        player.resourceSlot.addChild(resource);
      }
      traps = new TrapRow(content, tooltip);
      traps.position.set(0, 300);
      player.addChild(traps);
      if (state.hero.companion) {
        companion = new CompanionView(state.hero.companion, tooltip, layers.fx);
        companion.position.set(LAYOUT.player.x + 250, LAYOUT.player.y + 220);
        layers.ui.addChild(companion);
      }

      piles = { draw: new PileView('draw', PALETTE.gold), discard: new PileView('discard', PALETTE.blood), exhaust: new PileView('exhaust', PALETTE.type.status) };
      piles.draw.position.set(LAYOUT.draw.x, LAYOUT.draw.y);
      piles.discard.position.set(LAYOUT.discard.x, LAYOUT.discard.y);
      piles.exhaust.position.set(LAYOUT.exhaust.x, LAYOUT.exhaust.y);
      piles.exhaust.scale.set(0.7);
      layers.ui.addChild(piles.draw, piles.discard, piles.exhaust);

      bar = new CombatBar(content, explainer, onVial);
      bar.sync(state.hero);
      layers.ui.addChild(bar);

      endTurnBtn = new Button({ label: 'End Turn', width: 240, height: 64, onPress: doEndTurn });
      endTurnBtn.position.set(LAYOUT.endTurn.x, LAYOUT.endTurn.y);
      layers.ui.addChild(endTurnBtn);

      drag = new DragController({
        hand: layers.hand,
        floating: layers.floating,
        fx: layers.fx,
        stage: ctx.stage,
        canInteract: () => !busy && !state.prompt,
        isTargeted: (uid) => cardDef(uid)?.target === 'enemy',
        enemyAt: (x, y) => {
          for (const [id, v] of enemies) {
            if (v.dead) continue;
            const local = v.body.toLocal({ x, y }, shakeRoot);
            if (v.body.hitArea?.contains(local.x, local.y)) return id;
          }
          return null;
        },
        enemyCenter: (id) => {
          const v = enemies.get(id);
          return v && !v.dead ? v.center : null;
        },
        aimSpot: LAYOUT.aimSpot,
        highlightEnemy: (id) => {
          for (const [eid, v] of enemies) v.setHighlight(eid === id);
        },
        playLineY: LAYOUT.playLineY,
        onPlay: (uid, targetId) => tryPlay(uid, targetId),
        onInspect: (uid) => showInspector(uid),
        onReorder: (order) => {
          // The hand's order is presentational; write it back so draws keep it.
          state.piles.hand.sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid));
        },
      });

      for (const e of state.enemies) if (e.alive) addEnemy(e.id);
      layoutEnemies();
      for (const v of enemies.values()) v.position.set(v.x, v.y);

      playback = new Playback({
        get state() {
          return state;
        },
        content,
        hand: layers.hand,
        floating: layers.floating,
        fx: layers.fx,
        player,
        resource,
        companion,
        traps,
        enemies,
        piles,
        makeCardView,
        addEnemy,
        layoutEnemies,
        banner,
        shakeScreen,
        screenFlash,
        slowMo,
        positions: { draw: LAYOUT.draw, discard: LAYOUT.discard, exhaust: LAYOUT.exhaust, center: LAYOUT.center, powers: LAYOUT.powers },
        onEnd: endFight,
      });
      playback.reset();

      window.addEventListener('keydown', onKey);
      if (import.meta.env.DEV) {
        const dev = (window as unknown as { __tome?: Record<string, unknown> }).__tome;
        if (dev) dev.combat = { get state() { return state; }, content, get busy() { return busy; }, hand: layers.hand, enemies, get resource() { return resource; } };
      }
      if (resumed && state.events.length === 0) {
        // A saved fight mid-way: rebuild the hand from state.
        for (const inst of state.piles.hand) {
          const cv = makeCardView(inst.uid);
          if (cv) layers.hand.add(cv);
        }
        layers.hand.layout(true);
        playback.syncCounts();
        player.sync(state.hero);
        for (const e of state.enemies) {
          const v = enemies.get(e.id);
          if (!v || !e.alive) continue;
          v.setHp(e.hp, e.maxHp, e.block);
          v.setIntent(e.intent);
          for (const [k, n] of Object.entries(e.statuses)) v.statuses.set(k as keyof typeof e.statuses, n ?? 0);
        }
        layoutEnemies();
        busy = false;
        if (state.prompt) showPrompt();
        refreshHand();
        if (setup.tips) startCoach();
        return;
      }
      // The opening: the engine already drew; play those events.
      const events = drainEvents(state);
      await playback.play(events);
      busy = false;
      refreshHand();
      if (setup.tips) startCoach();
    },
    exit() {
      window.removeEventListener('keydown', onKey);
      drag?.dispose();
      if (fpsText) toggleFps();
      tooltip.destroy({ children: true });
      explainer.destroy({ children: true });
      gsap.globalTimeline.timeScale(1);
    },
  };
}
