import { Container } from 'pixi.js';
import { DESIGN } from '../app/fit';
import { FONT } from '../app/fonts';
import type { Scene, SceneContext } from '../app/router';
import { backdrop } from '../ui/kit/backdrop';
import { Button } from '../ui/kit/button';
import { PALETTE } from '../ui/kit/palette';
import { makeText, STYLE } from '../ui/kit/text';

/**
 * #/dev/text — the crispness proof. Resize the window and every line should
 * stay sharp, because Stage re-rasterises Text at dpr × scale.
 */
export function devTextScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'dev-text' });
  return {
    view,
    enter() {
      view.addChild(backdrop());
      let y = 60;
      const line = (t: string, style: Parameters<typeof makeText>[1], gap: number) => {
        const tx = makeText(t, style);
        tx.position.set(80, y);
        view.addChild(tx);
        y += gap;
      };
      line('Cinzel 96 — TOME OF SECRETS', { ...STYLE.display(96), fill: PALETTE.gold }, 120);
      line('Cinzel 48 — The Moss Halls · The Drowned Stacks · The Binding', STYLE.display(48), 70);
      line('Cinzel 30 — Templar’s Verdict · Kill Shot · Glacial Spike', STYLE.display(30), 50);
      line('Alegreya 32 — Spend all Holy Power: deal 5 damage, +4 per point.', STYLE.body(32), 46);
      line('Alegreya 26 — Deal 6 damage. Apply 2 Chill. If the target is Frozen, deal 30 instead.', STYLE.body(26), 40);
      line('Alegreya 22 — Armed: when an enemy attacks you, apply 4 Poison to it. Exhaust.', STYLE.body(22), 36);
      line('Alegreya italic 24 — “There is always a catch,” said the Archivist.', { ...STYLE.body(24), fontStyle: 'italic', fill: PALETTE.parchmentDim }, 40);
      line(`${FONT.mono} 20 — seed 7f3a-moss-9c · floor 6 · 42/80 hp · 113 gold`, STYLE.mono(20), 40);
      line('Alegreya 18 — the smallest size any card will use', STYLE.body(18), 40);

      const note = makeText(
        'Resize the window. Every line above should stay crisp at any size; if it softens, Stage.registerText is not reaching it.',
        { ...STYLE.body(22), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 1200 },
      );
      note.position.set(80, y + 30);
      view.addChild(note);

      const back = new Button({ label: 'Back', variant: 'ghost', width: 200, onPress: () => ctx.router.go('/dev/stats') });
      back.position.set(DESIGN.width - 200, DESIGN.height - 80);
      view.addChild(back);
    },
    exit() {},
  };
}
