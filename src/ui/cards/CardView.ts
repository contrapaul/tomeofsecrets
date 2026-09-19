import { Container, FillGradient, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Card, Rarity } from '../../content/schema';
import type { ResolvedCard, Segment } from '../../engine/rules';
import { FONT } from '../../app/fonts';
import { PALETTE } from '../kit/palette';
import { richText, type Run } from '../kit/richText';
import { makeText, STYLE } from '../kit/text';

export const CARD_W = 240;
export const CARD_H = 340;

const RARITY_GEM: Record<Rarity, number> = {
  starter: 0x8a8a8a,
  common: PALETTE.parchmentDim,
  uncommon: PALETTE.frost,
  rare: PALETTE.goldBright,
  secret: PALETTE.type.secret,
  curse: 0x9a6bb0,
  status: 0x6b6b6b,
};

function frameColor(card: Card): number {
  switch (card.class) {
    case 'paladin': return PALETTE.class.paladin;
    case 'tracker': return PALETTE.class.tracker;
    case 'mage': return PALETTE.class.mage;
    case 'secret': return PALETTE.type.secret;
    case 'curse': return PALETTE.type.curse;
    case 'status': return PALETTE.type.status;
    default: return PALETTE.parchmentDim;
  }
}

export interface CardDisplay {
  resolved: ResolvedCard;
  segments: Segment[];
  cost: { value: number; base: number } | 'X';
  /** Cropped to the art slot's ratio by `loadCardArt`; null draws the placeholder. */
  art?: Texture | null;
}

/**
 * One card, drawn at 240×340 with its pivot in the centre. The same object
 * is used in the hand, the reward screen, the shop, the inspector and the
 * Tome, only ever scaled, never re-laid-out.
 */
export class CardView extends Container {
  /** The engine's card instance id (Pixi already owns `uid`). */
  readonly cardUid: number;
  readonly card: Card;
  private readonly frame = new Graphics();
  private readonly glow = new Graphics();
  private readonly dynamic = new Container({ label: 'dynamic' });
  private readonly shadow = new Graphics();

  constructor(cardUid: number, card: Card, display: CardDisplay) {
    super({ label: `card:${card.id}` });
    this.cardUid = cardUid;
    this.card = card;
    this.pivot.set(CARD_W / 2, CARD_H / 2);

    this.shadow.roundRect(6, 10, CARD_W, CARD_H, 14).fill({ color: 0x000000, alpha: 0.45 });
    this.shadow.alpha = 0;
    this.addChild(this.shadow);

    this.glow.roundRect(-6, -6, CARD_W + 12, CARD_H + 12, 18).stroke({ color: PALETTE.goldBright, width: 5, alpha: 0.9 });
    this.glow.alpha = 0;
    this.addChild(this.glow);

    this.paintFrame();
    this.addChild(this.frame, this.dynamic);
    this.refresh(display);

    // A rectangular hit area; the rounded corners do not matter for pointing.
    this.eventMode = 'static';
    this.hitArea = { contains: (x, y) => x >= 0 && x <= CARD_W && y >= 0 && y <= CARD_H };
  }

  private paintFrame(): void {
    const g = this.frame;
    const color = frameColor(this.card);
    g.roundRect(0, 0, CARD_W, CARD_H, 14).fill(PALETTE.inkLight);
    g.roundRect(0, 0, CARD_W, CARD_H, 14).stroke({ color, width: 4, alignment: 1 });
    g.roundRect(4, 4, CARD_W - 8, CARD_H - 8, 11).stroke({ color: PALETTE.ink, width: 2, alpha: 0.8 });

    // Art slot: gradient of the frame colour into ink until real art lands.
    const grad = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      colorStops: [
        { offset: 0, color },
        { offset: 1, color: PALETTE.ink },
      ],
    });
    g.roundRect(12, 56, CARD_W - 24, 122, 6).fill(grad);
    g.roundRect(12, 56, CARD_W - 24, 122, 6).stroke({ color: 0x000000, width: 1, alpha: 0.6 });

    // Type banner with notched ends.
    const bannerY = 180;
    g.rect(0, bannerY, CARD_W, 28).fill(PALETTE.type[this.card.type]);
    g.poly([0, bannerY, 14, bannerY + 14, 0, bannerY + 28]).fill(PALETTE.inkLight);
    g.poly([CARD_W, bannerY, CARD_W - 14, bannerY + 14, CARD_W, bannerY + 28]).fill(PALETTE.inkLight);

    if (this.card.class === 'secret') {
      g.roundRect(0, 0, CARD_W, CARD_H, 14).stroke({ color: PALETTE.goldBright, width: 1.5, alpha: 0.6, alignment: 0 });
    }
  }

  /** Re-render the texts: name, cost, body, footer. Cheap enough to call on every hand change. */
  refresh(display: CardDisplay): void {
    this.dynamic.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { resolved, segments, cost } = display;

    // Cost orb.
    const orb = new Graphics();
    orb.circle(32, 32, 22).fill(
      new FillGradient({
        type: 'radial',
        center: { x: 0.35, y: 0.3 },
        innerRadius: 0,
        outerCenter: { x: 0.5, y: 0.5 },
        outerRadius: 0.55,
        colorStops: [
          { offset: 0, color: 0xffe9a6 },
          { offset: 0.55, color: PALETTE.gold },
          { offset: 1, color: 0x7a5a14 },
        ],
      }),
    );
    orb.circle(32, 32, 22).stroke({ color: PALETTE.ink, width: 2 });
    const costText = cost === 'X' ? 'X' : String(cost.value);
    const costColor = cost === 'X' || cost.value === cost.base ? PALETTE.ink : cost.value < cost.base ? 0x1f6b2f : 0x7a1c1c;
    const costLabel = makeText(costText, { fontFamily: FONT.display, fontWeight: '900', fontSize: 26, fill: costColor });
    costLabel.anchor.set(0.5);
    costLabel.position.set(32, 33);
    this.dynamic.addChild(orb, costLabel);

    // Name, shrinking to fit two lines between the orb and the gem.
    const name = makeText(resolved.name, { ...STYLE.display(17), letterSpacing: 0.3, wordWrap: true, wordWrapWidth: 124, align: 'center', lineHeight: 18 });
    if (name.height > 40) name.scale.set(36 / name.height);
    name.anchor.set(0.5);
    name.position.set(CARD_W / 2 + 4, 30);
    this.dynamic.addChild(name);

    if (display.art) {
      const art = new Sprite(display.art);
      art.width = CARD_W - 24;
      art.height = 122;
      art.position.set(12, 56);
      this.dynamic.addChild(art);
    } else {
      // Placeholder art: a big initial.
      const initial = makeText(resolved.name[0] ?? '?', { fontFamily: FONT.display, fontWeight: '900', fontSize: 84, fill: PALETTE.parchment });
      initial.alpha = 0.18;
      initial.anchor.set(0.5);
      initial.position.set(CARD_W / 2, 118);
      this.dynamic.addChild(initial);
    }

    // Banner label.
    const banner = makeText(resolved.type.toUpperCase(), { fontFamily: FONT.display, fontWeight: '700', fontSize: 13, letterSpacing: 2, fill: PALETTE.parchment });
    banner.anchor.set(0.5);
    banner.position.set(CARD_W / 2, 194);
    this.dynamic.addChild(banner);

    // Body text with coloured numbers.
    const runs: Run[] = segments.map((s) => {
      if (s.num) {
        const fill = s.num.value > s.num.base ? 0x8fd18f : s.num.value < s.num.base ? 0xe07b7b : PALETTE.goldBright;
        return { text: s.text, style: { fill, fontWeight: '700' } };
      }
      // A word the glossary explains: gold, so the player knows it can be asked about.
      if (s.term) return { text: s.text, style: { fill: PALETTE.gold, fontWeight: '700' } };
      return { text: s.text };
    });
    const bodySize = plainLength(segments) > 110 ? 15 : plainLength(segments) > 80 ? 16 : 17;
    const body = richText(runs, { width: CARD_W - 32, base: { fontFamily: FONT.body, fontSize: bodySize, fill: PALETTE.parchment } });
    const boxTop = 218;
    const boxH = 88;
    body.view.position.set(16, boxTop + Math.max(0, (boxH - body.height) / 2));
    this.dynamic.addChild(body.view);

    // Footer: rarity and tags.
    const footer = [resolved.type === 'status' || resolved.type === 'curse' ? resolved.type : this.card.rarity, ...(resolved.tags ?? [])]
      .map((s) => s.toUpperCase())
      .join(' · ');
    const foot = makeText(footer, { fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1, fill: PALETTE.parchmentDim });
    foot.anchor.set(0.5);
    foot.position.set(CARD_W / 2, CARD_H - 18);
    this.dynamic.addChild(foot);

    // Rarity gem.
    const gem = new Graphics();
    gem.rect(-8, -8, 16, 16).fill(RARITY_GEM[this.card.rarity]).stroke({ color: PALETTE.ink, width: 2 });
    gem.rotation = Math.PI / 4;
    gem.position.set(CARD_W - 22, 30);
    this.dynamic.addChild(gem);
  }

  /** Playable glow, or none. */
  setGlow(on: boolean): void {
    this.glow.alpha = on ? 1 : 0;
  }

  /** The drop shadow grows while dragging. */
  setShadow(alpha: number): void {
    this.shadow.alpha = alpha;
  }
}

function plainLength(segments: Segment[]): number {
  return segments.reduce((n, s) => n + s.text.length, 0);
}
