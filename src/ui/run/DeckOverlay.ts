import { Container, Graphics } from 'pixi.js';
import type { ContentRegistry } from '../../content';
import type { DeckCard } from '../../engine/run/run';
import { describeResolved, resolveCard } from '../../engine/rules';
import { DESIGN } from '../../app/fit';
import { CardView } from '../cards/CardView';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';

export interface DeckOverlayOptions {
  title: string;
  cards: DeckCard[];
  /** Pick mode: how many to choose; 0 or undefined means view only. */
  pick?: number;
  /** Only these are selectable in pick mode (e.g. not-yet-upgraded). */
  eligible?: (card: DeckCard) => boolean;
  /** Show every card upgraded (the Smith's preview). */
  preview?: 'upgraded';
  onDone: (uids: number[]) => void;
  cancelLabel?: string;
}

/** The deck as a grid of real cards; optionally a picker. Wheel scrolls. */
export class DeckOverlay extends Container {
  private selected: number[] = [];

  constructor(content: ContentRegistry, opts: DeckOverlayOptions) {
    super({ label: 'deck' });
    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.85 });
    dim.eventMode = 'static';
    this.addChild(dim);

    const title = makeText(opts.title.toUpperCase(), { ...STYLE.display(36), fill: PALETTE.gold, letterSpacing: 4 });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN.width / 2, 28);
    this.addChild(title);

    const grid = new Container();
    this.addChild(grid);
    const scale = 0.62;
    const cols = 9;
    const cw = 250 * scale + 40;
    const ch = 340 * scale + 40;
    const totalW = Math.min(opts.cards.length, cols) * cw;
    const x0 = (DESIGN.width - totalW) / 2 + cw / 2;
    const views = new Map<number, CardView>();
    const eligibleCount = opts.cards.filter((c) => !opts.eligible || opts.eligible(c)).length;
    const need = opts.pick ? Math.min(opts.pick, eligibleCount) : 0;

    const confirm = new Button({
      label: opts.pick ? 'Confirm' : 'Close',
      width: 220,
      height: 56,
      onPress: () => {
        if (opts.pick && this.selected.length < need) return;
        opts.onDone(this.selected);
      },
    });

    opts.cards.forEach((dc, i) => {
      const def = content.cards[dc.cardId];
      if (!def) return;
      const upgraded = dc.upgraded || opts.preview === 'upgraded';
      const resolved = resolveCard(def, upgraded);
      const cost = resolved.cost === 'X' ? ('X' as const) : { value: resolved.cost, base: resolved.cost };
      const cv = new CardView(dc.uid, def, { resolved, segments: describeResolved(resolved), cost });
      cv.scale.set(scale);
      cv.position.set(x0 + (i % cols) * cw, 110 + Math.floor(i / cols) * ch + ch / 2);
      const eligible = !opts.pick || !opts.eligible || opts.eligible(dc);
      if (!eligible) cv.alpha = 0.35;
      if (opts.pick && eligible) {
        cv.cursor = 'pointer';
        cv.on('pointertap', () => {
          const at = this.selected.indexOf(dc.uid);
          if (at >= 0) this.selected.splice(at, 1);
          else if (this.selected.length < opts.pick!) this.selected.push(dc.uid);
          for (const [uid, v] of views) v.setGlow(this.selected.includes(uid));
          confirm.alpha = this.selected.length >= need ? 1 : 0.5;
        });
        cv.on('pointerover', () => cv.scale.set(scale * 1.08));
        cv.on('pointerout', () => cv.scale.set(scale));
      }
      views.set(dc.uid, cv);
      grid.addChild(cv);
    });
    const rows = Math.ceil(opts.cards.length / cols);
    const overflow = Math.max(0, 110 + rows * ch - (DESIGN.height - 120));
    dim.on('wheel', (e) => {
      grid.y = Math.max(-overflow, Math.min(0, grid.y - e.deltaY * 0.8));
    });

    confirm.position.set(DESIGN.width / 2 + (opts.pick ? 130 : 0), DESIGN.height - 50);
    if (opts.pick) confirm.alpha = need === 0 ? 1 : 0.5;
    this.addChild(confirm);
    if (opts.pick) {
      const cancel = new Button({ label: opts.cancelLabel ?? 'Cancel', width: 220, height: 56, variant: 'ghost', onPress: () => opts.onDone([]) });
      cancel.position.set(DESIGN.width / 2 - 130, DESIGN.height - 50);
      this.addChild(cancel);
    }
  }
}
