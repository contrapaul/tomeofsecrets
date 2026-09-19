import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import gsap from 'gsap';
import { DESIGN } from '../../app/fit';
import type { Stage } from '../../app/stage';
import type { Enemy, Relic, Vial } from '../../content/schema';
import {
  explainCard, explainIntent, explainNode, explainRelic, explainResource, explainStatus, explainTerm, explainVial,
  type Content, type Explanation, type Intent, type LiveContext, type ResolvedCard, type Segment,
} from '../../engine/rules';
import { d } from './motion';
import { PALETTE } from './palette';
import { richText, type Run } from './richText';
import { makeText, STYLE } from './text';

export interface ExplainOptions {
  /** Hover delay; touch passes 0. */
  delayMs?: number;
  /** Where the column goes relative to the anchor. `auto` is right, or left near the edge. */
  side?: 'auto' | 'left' | 'right' | 'below' | 'above';
  /** Show the title and body, or only the glossary notes (a hand card already shows its own text). */
  header?: boolean;
}

const W = 320;
const PAD = 14;

/**
 * The one explainer for a scene, in `stage.overlay`: a column of small notes
 * beside whatever is being looked at, in the glossary's words. Hover shows it
 * after a short delay; touch shows it at once and keeps it until the next tap.
 * Never captures the pointer.
 */
export class Explainer extends Container {
  private readonly column = new Container();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sticky = false;
  private shownAt = 0;
  /** What a sticky touch explanation is about, so a second tap on it can mean "pick". */
  private anchor: Container | null = null;
  /** Called whenever an explanation appears; the tutorial listens. */
  onShow: (() => void) | null = null;

  constructor(private readonly content: Content, private readonly stage: Stage) {
    super({ label: 'explainer' });
    this.addChild(this.column);
    this.eventMode = 'none';
    this.visible = false;
    this.alpha = 0;
    // On touch, a tap that lands elsewhere closes a sticky explanation.
    this.stage.app.stage.on('pointerdown', () => {
      if (this.sticky && performance.now() - this.shownAt > 300) {
        this.sticky = false;
        this.hide();
      }
    });
  }

  // ---------------------------------------------------------------- pointer helpers

  /**
   * Explain `target` on hover (mouse) or on touch-down (Pixi sends no
   * pointerover for touch). `provide` runs at the moment of the hover, so it
   * sees current counts. Returns a function that reports whether the last
   * touch on the target has already been explained, for two-tap pickers.
   */
  attach(target: Container, provide: () => Explanation | null, opts: ExplainOptions = {}): { explainedByTouch: () => boolean } {
    let explained = false;
    const showFor = (e: FederatedPointerEvent) => {
      const ex = provide();
      if (ex) this.hover(e, target, ex, opts);
    };
    target.on('pointerover', (e) => {
      if (e.pointerType !== 'touch') showFor(e);
    });
    target.on('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      explained = this.sticky && this.anchor === target;
      showFor(e);
      this.anchor = target;
    });
    target.on('pointerout', () => this.leave());
    return { explainedByTouch: () => explained };
  }

  forCard(card: ResolvedCard, live?: LiveContext): Explanation {
    return explainCard(this.content, card, live);
  }
  forStatus(id: string, amount?: number): Explanation {
    return explainStatus(this.content, id, amount);
  }
  forIntent(def: Enemy, intent: Intent): Explanation {
    return explainIntent(this.content, def, intent);
  }
  forRelic(relic: Relic): Explanation {
    return explainRelic(this.content, relic);
  }
  forVial(vial: Vial): Explanation {
    return explainVial(this.content, vial);
  }
  forResource(name: 'holyPower' | 'charge' | 'energy', value?: number): Explanation {
    return explainResource(this.content, name, value);
  }
  forNode(type: string): Explanation {
    return explainNode(this.content, type);
  }
  forTerm(id: string): Explanation {
    return explainTerm(this.content, id);
  }

  /** Show for a hover; on touch it sticks until the next tap. */
  hover(e: FederatedPointerEvent | { pointerType?: string }, target: Container, ex: Explanation, opts: ExplainOptions = {}): void {
    const touch = e.pointerType === 'touch';
    this.show(target, ex, { ...opts, delayMs: touch ? 0 : opts.delayMs });
    this.sticky = touch;
  }

  /** The pointer left; ignored while a touch explanation is sticky. */
  leave(): void {
    if (this.sticky) return;
    this.hide();
  }

  card(e: { pointerType?: string }, target: Container, card: ResolvedCard, live?: LiveContext, opts: ExplainOptions = {}): void {
    this.hover(e, target, explainCard(this.content, card, live), { header: false, ...opts });
  }

  status(e: { pointerType?: string }, target: Container, id: string, amount?: number, opts: ExplainOptions = {}): void {
    this.hover(e, target, explainStatus(this.content, id, amount), opts);
  }

  intent(e: { pointerType?: string }, target: Container, def: Enemy, intent: Intent, opts: ExplainOptions = {}): void {
    this.hover(e, target, explainIntent(this.content, def, intent), { side: 'below', ...opts });
  }

  relic(e: { pointerType?: string }, target: Container, relic: Relic, opts: ExplainOptions = {}): void {
    this.hover(e, target, explainRelic(this.content, relic), opts);
  }

  vial(e: { pointerType?: string }, target: Container, vial: Vial, opts: ExplainOptions = {}): void {
    this.hover(e, target, explainVial(this.content, vial), opts);
  }

  resource(e: { pointerType?: string }, target: Container, name: 'holyPower' | 'charge' | 'energy', value?: number, opts: ExplainOptions = {}): void {
    this.hover(e, target, explainResource(this.content, name, value), opts);
  }

  node(e: { pointerType?: string }, target: Container, type: string, opts: ExplainOptions = {}): void {
    this.hover(e, target, explainNode(this.content, type), { side: 'below', ...opts });
  }

  term(e: { pointerType?: string }, target: Container, id: string, opts: ExplainOptions = {}): void {
    this.hover(e, target, explainTerm(this.content, id), opts);
  }

  // ---------------------------------------------------------------- core

  /** Show beside a display object; its bounds are read when the delay fires, so a lifting card has settled. */
  show(target: Container, ex: Explanation, opts: ExplainOptions = {}): void {
    clearTimeout(this.timer);
    const delay = opts.delayMs ?? 350;
    const fire = () => {
      if (target.destroyed || !this.parent) return;
      const b = target.getBounds();
      const tl = this.parent.toLocal({ x: b.x, y: b.y });
      const br = this.parent.toLocal({ x: b.x + b.width, y: b.y + b.height });
      this.showAt({ x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y }, ex, opts);
    };
    if (delay <= 0) fire();
    else this.timer = setTimeout(fire, delay);
  }

  /** Show beside a rectangle in the overlay's space. */
  showAt(anchor: { x: number; y: number; w: number; h: number }, ex: Explanation, opts: ExplainOptions = {}): void {
    const h = this.paint(ex, opts.header ?? true);
    if (h === 0) {
      this.hide();
      return;
    }
    const side = opts.side ?? 'auto';
    let x: number;
    let y: number;
    if (side === 'below' || side === 'above') {
      x = anchor.x + anchor.w / 2 - W / 2;
      y = side === 'below' ? anchor.y + anchor.h + 10 : anchor.y - h - 10;
    } else {
      const right = anchor.x + anchor.w + 12;
      const fitsRight = right + W <= DESIGN.width - 8;
      x = side === 'left' || (side === 'auto' && !fitsRight) ? anchor.x - W - 12 : right;
      y = anchor.y + anchor.h / 2 - h / 2;
    }
    x = Math.max(8, Math.min(DESIGN.width - W - 8, x));
    y = Math.max(8, Math.min(DESIGN.height - h - 8, y));
    this.position.set(Math.round(x), Math.round(y));
    this.visible = true;
    this.shownAt = performance.now();
    gsap.to(this, { alpha: 1, duration: d(0.12), overwrite: true });
    this.onShow?.();
  }

  hide(): void {
    clearTimeout(this.timer);
    this.sticky = false;
    this.anchor = null;
    if (!this.visible) return;
    gsap.to(this, { alpha: 0, duration: d(0.1), overwrite: true, onComplete: () => (this.visible = false) });
  }

  /** Lay the column out; returns its height, 0 when there is nothing to say. */
  private paint(ex: Explanation, header: boolean): number {
    this.column.removeChildren().forEach((c) => c.destroy({ children: true }));
    let y = 0;
    const box = (title: string, body: Segment[], big: boolean) => {
      const c = new Container();
      const bg = new Graphics();
      c.addChild(bg);
      const t = makeText(title, { ...STYLE.display(big ? 20 : 17), fill: PALETTE.gold, wordWrap: true, wordWrapWidth: W - PAD * 2 });
      t.position.set(PAD, 10);
      c.addChild(t);
      const runs: Run[] = body.map((s) => (s.term ? { text: s.text, style: { fill: PALETTE.gold, fontWeight: '700' } } : s.num ? { text: s.text, style: { fill: PALETTE.goldBright, fontWeight: '700' } } : { text: s.text }));
      const text = richText(runs, { width: W - PAD * 2, base: { ...STYLE.body(big ? 19 : 18), fill: PALETTE.parchment }, align: 'left' });
      text.view.position.set(PAD, 12 + t.height + 4);
      c.addChild(text.view);
      const h = 12 + t.height + 4 + text.height + 12;
      bg.roundRect(0, 0, W, h, 10).fill({ color: 0x14121c, alpha: 0.96 }).stroke({ color: PALETTE.gold, width: 1.5, alpha: big ? 1 : 0.6 });
      c.position.set(0, y);
      this.column.addChild(c);
      y += h + 8;
    };
    if (header && (ex.title || ex.body.some((s) => s.text.trim()))) box(ex.title, ex.body, true);
    for (const n of ex.notes) box(n.name, [{ text: n.text }], false);
    return y ? y - 8 : 0;
  }
}
