import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { IntentKind } from '../../content/schema';
import { FONT } from '../../app/fonts';
import { icon, type IconName } from '../kit/icons';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText } from '../kit/text';
import type { Tooltip } from '../kit/tooltip';

const KIND_ICON: Record<IntentKind, IconName> = { attack: 'sword', defend: 'shield', buff: 'up', debuff: 'down', special: 'star', summon: 'summon' };
const KIND_COLOR: Record<IntentKind, number> = {
  attack: PALETTE.type.attack, defend: PALETTE.type.skill, buff: PALETTE.type.power, debuff: PALETTE.type.curse, special: PALETTE.type.secret, summon: 0x5a5a6a,
};
const KIND_TEXT: Record<IntentKind, string> = {
  attack: 'It will attack.', defend: 'It will gain block.', buff: 'It will make itself stronger.', debuff: 'It will weaken you.', special: 'Something else is coming.', summon: 'It will call for help.',
};

/** The bubble above an enemy: what it is about to do, with numbers. */
export class IntentBadge extends Container {
  private readonly bg = new Graphics();
  private readonly num = makeText('', { fontFamily: FONT.mono, fontSize: 20, fill: PALETTE.parchment });
  private glyph: Container | null = null;
  private current: { kind: IntentKind; hidden: boolean; damage?: number; hits?: number; block?: number } | null = null;

  constructor(private readonly tooltip: Tooltip) {
    super({ label: 'intent' });
    this.addChild(this.bg, this.num);
    this.num.anchor.set(0, 0.5);
    this.eventMode = 'static';
    this.on('pointerover', () => {
      if (!this.current) return;
      const p = this.tooltip.parent!.toLocal(this.getGlobalPosition());
      const c = this.current;
      const body = c.hidden ? 'Its next move is hidden.' : c.damage !== undefined ? `It will hit for ${c.damage}${c.hits && c.hits > 1 ? `, ${c.hits} times` : ''}.` : c.block ? `It will gain ${c.block} block.` : KIND_TEXT[c.kind];
      this.tooltip.show('Intent', body, p.x, p.y);
    });
    this.on('pointerout', () => this.tooltip.hide());
    this.visible = false;
  }

  set(intent: { kind: IntentKind; hidden: boolean; damage?: number; hits?: number; block?: number } | null): void {
    this.current = intent;
    if (!intent) {
      this.visible = false;
      return;
    }
    this.visible = true;
    const kind = intent.hidden ? null : intent.kind;
    this.glyph?.destroy();
    this.glyph = icon(kind ? KIND_ICON[kind] : 'question', 0xffffff, 26);
    this.glyph.position.set(22, 0);
    this.addChild(this.glyph);
    let text = '';
    if (!intent.hidden) {
      if (intent.damage !== undefined) text = intent.hits && intent.hits > 1 ? `${intent.damage} ×${intent.hits}` : `${intent.damage}`;
      else if (intent.block) text = `+${intent.block}`;
    }
    this.num.text = text;
    this.num.position.set(44, 0);
    const w = 44 + (text ? this.num.width + 14 : 0);
    this.bg.clear();
    this.bg.roundRect(0, -22, w, 44, 22).fill({ color: 0x000000, alpha: 0.55 });
    this.bg.circle(22, 0, 20).fill(kind ? KIND_COLOR[kind] : PALETTE.type.status);
    this.pivot.set(w / 2, 0);
    gsap.fromTo(this.scale, { x: 0.7, y: 0.7 }, { x: 1, y: 1, duration: d(0.25), ease: 'back.out(2)' });
  }
}
