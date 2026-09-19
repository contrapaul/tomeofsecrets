import { Container, Graphics } from 'pixi.js';
import { explainVial, type Content, type HeroState } from '../../engine/rules';
import { DESIGN } from '../../app/fit';
import { FONT } from '../../app/fonts';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import type { Explainer } from '../kit/explainer';

/** Relics and vials along the top of a fight. Vials are clickable. */
export class CombatBar extends Container {
  private readonly items = new Container();
  selectedVial: number | null = null;

  constructor(private readonly content: Content, private readonly explainer: Explainer, private readonly onVial: (index: number) => void) {
    super({ label: 'combat-bar' });
    const bg = new Graphics();
    bg.rect(0, 0, DESIGN.width, 56).fill({ color: 0x000000, alpha: 0.35 });
    this.addChild(bg, this.items);
  }

  sync(hero: HeroState): void {
    this.items.removeChildren().forEach((c) => c.destroy({ children: true }));
    let x = 40;
    for (const id of hero.relics) {
      const relic = this.content.relics?.[id];
      if (!relic) continue;
      const c = new Container();
      const g = new Graphics();
      g.circle(0, 0, 18).fill({ color: 0x2a2210 }).stroke({ color: PALETTE.gold, width: 2 });
      c.addChild(g);
      const letter = makeText(relic.name[0]!, { fontFamily: FONT.display, fontWeight: '700', fontSize: 16, fill: PALETTE.goldBright });
      letter.anchor.set(0.5);
      c.addChild(letter);
      c.position.set(x, 28);
      c.eventMode = 'static';
      this.explainer.attach(c, () => this.explainer.forRelic(relic), { side: 'below' });
      this.items.addChild(c);
      x += 44;
    }
    let rx = DESIGN.width - 40;
    for (let i = hero.vialSlots - 1; i >= 0; i--) {
      const id = hero.vials[i];
      const vial = id ? this.content.vials?.[id] : undefined;
      const c = new Container();
      const g = new Graphics();
      const selected = this.selectedVial === i;
      g.roundRect(-16, -18, 32, 36, 8).fill({ color: vial ? 0x2b3d4e : 0x14121c }).stroke({ color: selected ? PALETTE.goldBright : vial ? PALETTE.frost : 0x3a3a4a, width: selected ? 3 : 2 });
      c.addChild(g);
      if (vial) {
        const l = makeText(vial.name[0]!, { fontFamily: FONT.display, fontWeight: '700', fontSize: 16, fill: PALETTE.parchment });
        l.anchor.set(0.5);
        c.addChild(l);
        c.eventMode = 'static';
        c.cursor = 'pointer';
        const hint = this.explainer.attach(c, () => ({ ...explainVial(this.content, vial), body: [{ text: `${vial.text}${vial.target === 'enemy' ? ' Click, then click an enemy.' : ' Click to drink.'}` }] }), { side: 'below' });
        c.on('pointertap', (e) => {
          // On touch the first tap explains; the second drinks.
          if (e.pointerType === 'touch' && !hint.explainedByTouch()) return;
          this.onVial(i);
        });
      }
      c.position.set(rx - 16, 28);
      this.items.addChild(c);
      rx -= 40;
    }
    if (hero.vialSlots) {
      const label = makeText('VIALS', { ...STYLE.mono(11), letterSpacing: 1.5, fill: PALETTE.parchmentDim });
      label.anchor.set(1, 0.5);
      label.position.set(rx - 6, 28);
      this.items.addChild(label);
    }
  }
}
