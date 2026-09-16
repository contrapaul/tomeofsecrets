import { ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import gsap from 'gsap';
import type { Enemy } from '../../content/schema';
import type { EnemyInstance, Intent } from '../../engine/rules';
import { FONT } from '../../app/fonts';
import { floatNumber, shake } from '../fx/numbers';
import { d, done, spatial } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText } from '../kit/text';
import type { Tooltip } from '../kit/tooltip';
import { HpBar } from './HpBar';
import { IntentBadge } from './IntentBadge';
import { StatusRow } from './StatusRow';

const SIZE_H = { small: 230, medium: 330, large: 440 } as const;
const SIZE_W = { small: 200, medium: 260, large: 330 } as const;

/**
 * An enemy on the table: the puppet, its bars and badges. Positioned at its
 * feet; the body grows upward. With a texture, the sprite is the body;
 * without one, a placeholder shape stands in until Phase 4 art lands.
 */
export class EnemyView extends Container {
  readonly id: string;
  readonly body = new Container({ label: 'body' });
  readonly hp: HpBar;
  readonly intent: IntentBadge;
  readonly statuses: StatusRow;
  private readonly bodyH: number;
  private readonly bodyW: number;
  private idleTl: gsap.core.Timeline | null = null;
  private readonly matrix = new ColorMatrixFilter();
  private readonly highlight = new Graphics();
  dead = false;

  constructor(inst: EnemyInstance, def: Enemy, texture: Texture | null, tooltip: Tooltip, private readonly fxLayer: Container) {
    super({ label: `enemy:${inst.id}` });
    this.id = inst.id;
    this.bodyH = SIZE_H[def.size];
    this.bodyW = SIZE_W[def.size];

    // Selection ring on the ground.
    this.highlight.ellipse(0, 0, this.bodyW * 0.55, 22).stroke({ color: PALETTE.goldBright, width: 4, alpha: 0.9 });
    this.highlight.alpha = 0;
    this.addChild(this.highlight);

    const shadow = new Graphics();
    shadow.ellipse(0, 6, this.bodyW * 0.5, 18).fill({ color: 0x000000, alpha: 0.45 });
    this.addChild(shadow);

    if (texture) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);
      const s = this.bodyH / sprite.height;
      sprite.scale.set(s);
      this.body.addChild(sprite);
    } else {
      this.body.addChild(this.placeholder(def));
    }
    this.body.filters = [this.matrix];
    this.addChild(this.body);

    const name = makeText(def.name, { fontFamily: FONT.display, fontWeight: '700', fontSize: 18, fill: PALETTE.parchment, stroke: { color: 0x000000, width: 3 } });
    name.anchor.set(0.5, 0);
    name.position.set(0, 28);
    this.addChild(name);

    this.hp = new HpBar(Math.max(150, this.bodyW * 0.7));
    this.hp.position.set(-this.hp.width / 2 + 8, 54);
    this.hp.pivot.set(0, 0);
    this.addChild(this.hp);
    // HpBar pivots at its top-left; centre it under the name.
    this.hp.position.set(-Math.max(150, this.bodyW * 0.7) / 2, 54);

    this.statuses = new StatusRow(tooltip);
    this.statuses.position.set(0, 100);
    this.addChild(this.statuses);

    this.intent = new IntentBadge(tooltip);
    this.intent.position.set(0, -this.bodyH - 40);
    this.addChild(this.intent);

    this.hp.set(inst.hp, inst.maxHp, inst.block);
    this.setIntent(inst.intent);
    for (const [k, v] of Object.entries(inst.statuses)) this.statuses.set(k as keyof typeof inst.statuses, v ?? 0);

    this.body.eventMode = 'static';
    this.body.hitArea = { contains: (x, y) => Math.abs(x) <= this.bodyW / 2 && y <= 0 && y >= -this.bodyH };
    this.idle();
  }

  private placeholder(def: Enemy): Container {
    const c = new Container();
    const tint = def.tags.includes('undead') ? 0x6f7f8a : def.tags.includes('ooze') ? 0x3a3f8a : def.tags.includes('beast') ? 0x7a5a3a : def.tags.includes('spirit') ? 0x6fb3d9 : def.tags.includes('demon') ? 0x8a2f3f : def.tags.includes('construct') ? 0x7a7a6a : def.tags.includes('plant') ? 0x4f7a3a : 0x8a6f4a;
    const g = new Graphics();
    const w = this.bodyW;
    const h = this.bodyH;
    // A rounded body with a "head" so a lunge reads as a creature, not a box.
    g.roundRect(-w / 2, -h * 0.72, w, h * 0.72, w * 0.25).fill(tint).stroke({ color: 0x000000, width: 3, alpha: 0.6 });
    g.circle(0, -h * 0.82, w * 0.28).fill(tint).stroke({ color: 0x000000, width: 3, alpha: 0.6 });
    g.circle(-w * 0.1, -h * 0.85, w * 0.05).fill(0x0b0a0f);
    g.circle(w * 0.1, -h * 0.85, w * 0.05).fill(0x0b0a0f);
    c.addChild(g);
    const initial = makeText(def.name[0] ?? '?', { fontFamily: FONT.display, fontWeight: '900', fontSize: Math.round(h * 0.28), fill: 0x000000 });
    initial.alpha = 0.25;
    initial.anchor.set(0.5);
    initial.position.set(0, -h * 0.38);
    c.addChild(initial);
    return c;
  }

  /** Breathe and sway forever, until death. */
  idle(): void {
    this.idleTl?.kill();
    if (!spatial()) return;
    const phase = Math.random() * 2;
    this.idleTl = gsap.timeline({ repeat: -1, yoyo: true, delay: -phase });
    this.idleTl.to(this.body.scale, { y: 1.02, x: 0.99, duration: 1.1, ease: 'sine.inOut' }, 0);
    this.idleTl.to(this.body, { rotation: 0.012, duration: 1.55, ease: 'sine.inOut' }, 0);
  }

  setHp(hp: number, max: number, block: number): void {
    this.hp.set(hp, max, block);
  }

  setBlock(block: number): void {
    this.hp.setBlock(block);
  }

  setIntent(intent: Intent | null): void {
    this.intent.set(intent);
  }

  /** Targetable: a ring at the feet. */
  setHighlight(on: boolean): void {
    gsap.to(this.highlight, { alpha: on ? 1 : 0, duration: d(0.1) });
  }

  /** Anticipation, lunge toward the hero (to the left), recoil. */
  async attack(): Promise<void> {
    if (!spatial()) return;
    this.idleTl?.pause();
    const tl = gsap.timeline();
    tl.to(this.body, { x: 24, duration: d(0.12), ease: 'power2.in' })
      .to(this.body, { x: -90, duration: d(0.1), ease: 'power3.out' })
      .to(this.body, { x: 0, duration: d(0.25), ease: 'power2.inOut' });
    await done(tl);
    this.idleTl?.resume();
  }

  /** Flash white, shake, float the number. */
  async hit(amount: number, blocked: number, hpDamage: number): Promise<void> {
    const x = this.x;
    const y = this.y - this.bodyH * 0.6;
    if (blocked > 0 && hpDamage === 0) void floatNumber(this.fxLayer, x, y, `${blocked}`, 'blocked');
    else void floatNumber(this.fxLayer, x, y, `${hpDamage}`, 'damage', hpDamage >= 15);
    if (amount === 0) return;
    if (!spatial()) return;
    this.matrix.reset();
    this.matrix.brightness(2.2, false);
    await Promise.all([
      shake(this.body, Math.min(14, 4 + hpDamage / 3)),
      done(gsap.to({ t: 0 }, { t: 1, duration: d(0.1), onComplete: () => this.matrix.reset() })),
    ]);
  }

  negated(by: string): void {
    void floatNumber(this.fxLayer, this.x, this.y - this.bodyH * 0.6, by, 'negated');
  }

  buff(): void {
    if (!spatial()) return;
    gsap.fromTo(this.body.scale, { x: 1.06, y: 1.06 }, { x: 1, y: 1, duration: d(0.3), ease: 'power2.out' });
  }

  /** Freeze, drain the colour, sink and fade. */
  async die(): Promise<void> {
    this.dead = true;
    this.idleTl?.kill();
    this.intent.set(null);
    this.matrix.reset();
    this.matrix.desaturate();
    await done(gsap.to(this.body, { alpha: 0, y: 40, duration: d(0.55), ease: 'power2.in', delay: d(0.12) }));
    await done(gsap.to(this, { alpha: 0, duration: d(0.2) }));
  }
}
