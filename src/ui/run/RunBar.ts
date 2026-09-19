import { Container, Graphics } from 'pixi.js';
import type { RunState } from '../../engine/run/run';
import type { ContentRegistry } from '../../content';
import { DESIGN } from '../../app/fit';
import { FONT } from '../../app/fonts';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import type { Explainer } from '../kit/explainer';

/**
 * The strip along the top of every run screen: HP, gold, floor, relics,
 * vials, and a Deck button. Rebuilt from the run on every `sync`.
 */
export class RunBar extends Container {
  private readonly items = new Container();

  constructor(private readonly content: ContentRegistry, private readonly explainer: Explainer, private readonly onDeck: () => void) {
    super({ label: 'runbar' });
    const bg = new Graphics();
    bg.rect(0, 0, DESIGN.width, 64).fill({ color: 0x000000, alpha: 0.55 });
    bg.rect(0, 63, DESIGN.width, 1).fill({ color: PALETTE.gold, alpha: 0.5 });
    this.addChild(bg, this.items);
  }

  sync(run: RunState): void {
    this.items.removeChildren().forEach((c) => c.destroy({ children: true }));
    const cls = this.content.classes[run.hero.classId];
    let x = 24;
    const put = (text: string, style = STYLE.mono(22), gap = 28) => {
      const t = makeText(text, style);
      t.position.set(x, 32);
      t.anchor.set(0, 0.5);
      this.items.addChild(t);
      x += t.width + gap;
      return t;
    };
    put((cls?.name ?? run.hero.classId).toUpperCase(), { ...STYLE.display(22), fill: PALETTE.class[run.hero.classId] });
    put(`♥ ${run.hero.hp}/${run.hero.maxHp}`, { ...STYLE.mono(22), fill: 0xf0a0a0 });
    put(`◆ ${run.hero.gold}`, { ...STYLE.mono(22), fill: PALETTE.goldBright });
    put(`floor ${Math.max(0, run.stats.floorsClimbed)} · chapter ${run.chapter}`, { ...STYLE.mono(18), fill: PALETTE.parchmentDim });

    x += 12;
    for (const id of run.hero.relics) {
      const relic = this.content.relics[id];
      if (!relic) continue;
      const c = new Container();
      const g = new Graphics();
      g.circle(0, 0, 20).fill({ color: 0x2a2210 }).stroke({ color: PALETTE.gold, width: 2 });
      c.addChild(g);
      const letter = makeText(relic.name[0]!, { fontFamily: FONT.display, fontWeight: '700', fontSize: 18, fill: PALETTE.goldBright });
      letter.anchor.set(0.5);
      c.addChild(letter);
      c.position.set(x + 20, 32);
      c.eventMode = 'static';
      this.explainer.attach(c, () => this.explainer.forRelic(relic), { side: 'below' });
      this.items.addChild(c);
      x += 48;
    }

    let rx = DESIGN.width - 24;
    const deck = new Container();
    const n = run.hero.deck.length;
    const dt = makeText(`DECK · ${n} CARD${n === 1 ? '' : 'S'}`, { ...STYLE.display(18), fill: PALETTE.parchment });
    dt.anchor.set(0.5);
    const dw = Math.ceil(dt.width) + 36;
    const dg = new Graphics();
    dg.roundRect(-dw / 2, -20, dw, 40, 8).fill({ color: PALETTE.parchment, alpha: 0.08 }).stroke({ color: PALETTE.gold, width: 2 });
    deck.addChild(dg, dt);
    deck.position.set(rx - dw / 2, 32);
    deck.eventMode = 'static';
    deck.cursor = 'pointer';
    deck.on('pointertap', this.onDeck);
    this.items.addChild(deck);
    rx -= dw + 20;
    for (let i = run.hero.vialSlots - 1; i >= 0; i--) {
      const id = run.hero.vials[i];
      const vial = id ? this.content.vials[id] : undefined;
      const c = new Container();
      const g = new Graphics();
      g.roundRect(-16, -18, 32, 36, 8).fill({ color: vial ? 0x2b3d4e : 0x14121c }).stroke({ color: vial ? PALETTE.frost : 0x3a3a4a, width: 2 });
      c.addChild(g);
      if (vial) {
        const l = makeText(vial.name[0]!, { fontFamily: FONT.display, fontWeight: '700', fontSize: 16, fill: PALETTE.parchment });
        l.anchor.set(0.5);
        c.addChild(l);
        c.eventMode = 'static';
        this.explainer.attach(c, () => this.explainer.forVial(vial), { side: 'below' });
      }
      c.position.set(rx - 16, 32);
      this.items.addChild(c);
      rx -= 40;
    }
  }
}
