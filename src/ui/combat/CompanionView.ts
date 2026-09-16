import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { CompanionState } from '../../engine/rules';
import { FONT } from '../../app/fonts';
import { floatNumber } from '../fx/numbers';
import { d, done, spatial } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText } from '../kit/text';
import type { Tooltip } from '../kit/tooltip';

const NAMES: Record<CompanionState['id'], { name: string; action: string; text: string }> = {
  wolf: { name: 'Wolf', action: 'Bite 5', text: 'At the end of your turn: 5 damage to a random enemy.' },
  bear: { name: 'Bear', action: 'Guard 5', text: 'At the end of your turn: you gain 5 block.' },
  hawk: { name: 'Hawk', action: 'Peck 2 + Mark', text: 'At the end of your turn: 2 damage and 1 Mark to a random enemy.' },
  serpent: { name: 'Serpent', action: 'Venom 3', text: 'At the end of your turn: 3 Poison to a random enemy.' },
  boar: { name: 'Boar', action: 'Gore 8 (every other turn)', text: 'Every other turn: 8 damage to a random enemy.' },
};

/** The Tracker's animal, at the hero's side with its own little intent line. */
export class CompanionView extends Container {
  private readonly body = new Container();
  private readonly action = makeText('', { fontFamily: FONT.mono, fontSize: 15, fill: PALETTE.parchment });
  private readonly state = makeText('', { fontFamily: FONT.mono, fontSize: 13, fill: PALETTE.goldBright });
  private bonus = 0;
  private stunned = false;
  private enraged = false;

  constructor(private readonly companion: CompanionState, tooltip: Tooltip, private readonly fxLayer: Container) {
    super({ label: 'companion' });
    const g = new Graphics();
    g.ellipse(0, 6, 46, 12).fill({ color: 0x000000, alpha: 0.4 });
    g.roundRect(-34, -70, 68, 62, 22).fill(0x7a5a3a).stroke({ color: 0x000000, width: 3, alpha: 0.6 });
    g.circle(0, -84, 22).fill(0x7a5a3a).stroke({ color: 0x000000, width: 3, alpha: 0.6 });
    g.circle(-8, -86, 3.5).fill(0x0b0a0f);
    g.circle(8, -86, 3.5).fill(0x0b0a0f);
    g.poly([-20, -100, -12, -118, -4, -100]).fill(0x7a5a3a);
    g.poly([20, -100, 12, -118, 4, -100]).fill(0x7a5a3a);
    this.body.addChild(g);
    this.addChild(this.body);

    const name = makeText(NAMES[companion.id].name.toUpperCase(), { fontFamily: FONT.display, fontWeight: '700', fontSize: 15, fill: PALETTE.class.tracker, letterSpacing: 1 });
    name.anchor.set(0.5, 0);
    name.position.set(0, 16);
    this.action.anchor.set(0.5, 0);
    this.action.position.set(0, 36);
    this.state.anchor.set(0.5, 0);
    this.state.position.set(0, 56);
    this.addChild(name, this.action, this.state);

    this.eventMode = 'static';
    this.on('pointerover', () => {
      const p = tooltip.parent!.toLocal(this.getGlobalPosition());
      tooltip.show(`${NAMES[companion.id].name}${this.bonus ? ` (+${this.bonus})` : ''}`, NAMES[companion.id].text, p.x, p.y - 60);
    });
    this.on('pointerout', () => tooltip.hide());
    this.sync(companion);
    this.idle();
  }

  private idle(): void {
    if (!spatial()) return;
    gsap.to(this.body.scale, { y: 1.03, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  sync(c: CompanionState): void {
    this.bonus = c.bonus;
    this.stunned = c.stunned;
    this.enraged = c.enraged;
    this.refresh();
  }

  private refresh(): void {
    const base = NAMES[this.companion.id].action;
    this.action.text = this.bonus ? `${base} +${this.bonus}` : base;
    this.state.text = this.stunned ? 'STUNNED' : this.enraged ? 'ENRAGED' : '';
    this.state.style.fill = this.stunned ? 0xe07b7b : PALETTE.goldBright;
  }

  async act(): Promise<void> {
    if (!spatial()) return;
    const tl = gsap.timeline();
    tl.to(this.body, { x: -14, duration: d(0.1), ease: 'power2.in' }).to(this.body, { x: 70, duration: d(0.1), ease: 'power3.out' }).to(this.body, { x: 0, duration: d(0.25), ease: 'power2.inOut' });
    await done(tl);
    this.enraged = false;
    this.refresh();
  }

  enrage(): void {
    this.enraged = true;
    this.refresh();
    void floatNumber(this.fxLayer, this.x, this.y - 120, 'Enraged!', 'status');
  }

  stun(on: boolean): void {
    this.stunned = on;
    this.refresh();
    if (on) void floatNumber(this.fxLayer, this.x, this.y - 120, 'Stunned', 'negated');
  }

  feed(bonusTotal: number): void {
    this.bonus = bonusTotal;
    this.refresh();
    void floatNumber(this.fxLayer, this.x, this.y - 120, `+${bonusTotal}`, 'status');
    gsap.fromTo(this.body.scale, { x: 1.15, y: 1.15 }, { x: 1, y: 1, duration: d(0.3), ease: 'back.out(2)' });
  }
}
