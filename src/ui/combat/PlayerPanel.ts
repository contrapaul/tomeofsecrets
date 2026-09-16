import { Container, FillGradient, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { ClassId } from '../../content/schema';
import type { HeroState } from '../../engine/rules';
import { FONT } from '../../app/fonts';
import { floatNumber, shake } from '../fx/numbers';
import { d, spatial } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import type { Tooltip } from '../kit/tooltip';
import { HpBar } from './HpBar';
import { StatusRow } from './StatusRow';

const CLASS_NAME: Record<ClassId, string> = { paladin: 'Paladin', tracker: 'Tracker', mage: 'Mage' };

/** The hero's corner: portrait, HP, block, statuses, and the energy orb. */
export class PlayerPanel extends Container {
  readonly portrait = new Container({ label: 'portrait' });
  readonly hp: HpBar;
  readonly statuses: StatusRow;
  readonly energyOrb = new Container({ label: 'energy' });
  /** Where class widgets (Holy Power pips, Charges) mount in Phase 3. */
  readonly resourceSlot = new Container({ label: 'resource' });
  private readonly energyText = makeText('3', { fontFamily: FONT.display, fontWeight: '900', fontSize: 44, fill: PALETTE.ink });
  private readonly energyMax = makeText('/3', { fontFamily: FONT.mono, fontSize: 16, fill: PALETTE.ink });
  private readonly classId: ClassId;

  constructor(hero: HeroState, tooltip: Tooltip, private readonly fxLayer: Container) {
    super({ label: 'player' });
    this.classId = hero.classId;
    const color = PALETTE.class[hero.classId];

    // Portrait placeholder: a ring in the class colour.
    const ring = new Graphics();
    ring.circle(0, 0, 92).fill(new FillGradient({ type: 'radial', center: { x: 0.4, y: 0.35 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.6, colorStops: [{ offset: 0, color: PALETTE.inkLight }, { offset: 1, color: PALETTE.ink }] }));
    ring.circle(0, 0, 92).stroke({ color, width: 6 });
    ring.circle(0, 0, 84).stroke({ color: PALETTE.ink, width: 2 });
    const initial = makeText(CLASS_NAME[hero.classId][0]!, { fontFamily: FONT.display, fontWeight: '900', fontSize: 90, fill: color });
    initial.anchor.set(0.5);
    initial.alpha = 0.7;
    this.portrait.addChild(ring, initial);
    this.addChild(this.portrait);

    const name = makeText(CLASS_NAME[hero.classId].toUpperCase(), { ...STYLE.display(22), fill: color });
    name.anchor.set(0.5, 0);
    name.position.set(0, 104);
    this.addChild(name);

    this.hp = new HpBar(220, 22);
    this.hp.position.set(-110, 136);
    this.addChild(this.hp);

    this.statuses = new StatusRow(tooltip);
    this.statuses.position.set(0, 190);
    this.addChild(this.statuses);

    this.resourceSlot.position.set(0, 236);
    this.addChild(this.resourceSlot);

    // Energy orb.
    const orb = new Graphics();
    orb.circle(0, 0, 54).fill(new FillGradient({ type: 'radial', center: { x: 0.35, y: 0.3 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.6, colorStops: [{ offset: 0, color: 0xffe9a6 }, { offset: 0.55, color: PALETTE.gold }, { offset: 1, color: 0x7a5a14 }] }));
    orb.circle(0, 0, 54).stroke({ color: PALETTE.ink, width: 3 });
    this.energyText.anchor.set(0.5);
    this.energyText.position.set(-6, 2);
    this.energyMax.anchor.set(0, 0.5);
    this.energyMax.position.set(14, 10);
    this.energyOrb.addChild(orb, this.energyText, this.energyMax);
    this.energyOrb.eventMode = 'static';
    this.energyOrb.on('pointerover', () => {
      const p = tooltip.parent!.toLocal(this.energyOrb.getGlobalPosition());
      tooltip.show('Energy', 'Cards cost energy to play. It refills to your maximum at the start of each turn.', p.x, p.y);
    });
    this.energyOrb.on('pointerout', () => tooltip.hide());
    this.addChild(this.energyOrb);

    this.sync(hero);
  }

  sync(hero: HeroState): void {
    this.hp.set(hero.hp, hero.maxHp, hero.block);
    this.setEnergy(hero.energy, hero.maxEnergy);
    for (const [k, v] of Object.entries(hero.statuses)) this.statuses.set(k as keyof typeof hero.statuses, v ?? 0);
  }

  setEnergy(value: number, max: number): void {
    this.energyText.text = String(value);
    this.energyMax.text = `/${max}`;
    this.energyText.style.fill = value === 0 ? 0x7a1c1c : PALETTE.ink;
  }

  /** The orb flashes red when a card costs more than you have. */
  refuseEnergy(): void {
    gsap.fromTo(this.energyOrb.scale, { x: 1.15, y: 1.15 }, { x: 1, y: 1, duration: d(0.25), ease: 'elastic.out(1, 0.4)' });
    void shake(this.energyOrb, 6, 2);
  }

  async hit(amount: number, blocked: number, hpDamage: number): Promise<void> {
    const x = this.x;
    const y = this.y - 40;
    if (blocked > 0 && hpDamage === 0) void floatNumber(this.fxLayer, x, y, `${blocked}`, 'blocked');
    else void floatNumber(this.fxLayer, x, y, `${hpDamage}`, 'damage', hpDamage >= 15);
    if (amount > 0 && spatial()) await shake(this.portrait, Math.min(16, 5 + hpDamage / 2));
  }

  heal(amount: number): void {
    void floatNumber(this.fxLayer, this.x, this.y - 40, `+${amount}`, 'heal');
  }

  blockGain(amount: number): void {
    if (amount > 0) void floatNumber(this.fxLayer, this.x + 60, this.y + 20, `+${amount}`, 'block');
  }

  negated(by: string): void {
    void floatNumber(this.fxLayer, this.x, this.y - 40, by, 'negated');
  }

  get className(): string {
    return CLASS_NAME[this.classId];
  }
}
