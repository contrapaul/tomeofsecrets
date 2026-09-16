import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../../app/fit';
import type { Scene, SceneContext } from '../../app/router';
import type { Motion } from '../../app/settings';
import { backdrop } from '../kit/backdrop';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';

const MOTIONS: { id: Motion; label: string; blurb: string }[] = [
  { id: 'full', label: 'Full', blurb: 'Every animation at full length.' },
  { id: 'fast', label: 'Fast', blurb: 'Half length. For players who know the game.' },
  { id: 'reduced', label: 'Reduced', blurb: 'Near-instant, fades only. No motion cues.' },
];

export function settingsScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'settings' });
  let repaint: () => void = () => {};

  return {
    view,
    enter() {
      view.addChild(backdrop());
      const title = makeText('SETTINGS', { ...STYLE.display(64), fill: PALETTE.gold });
      title.anchor.set(0.5, 0);
      title.position.set(DESIGN.width / 2, 120);
      view.addChild(title);

      const panel = new Graphics();
      panel.roundRect(460, 260, 1000, 520, 16).fill({ color: PALETTE.parchment, alpha: 0.06 }).stroke({ color: PALETTE.gold, width: 2, alpha: 0.5 });
      view.addChild(panel);

      const motionLabel = makeText('Motion', STYLE.display(30));
      motionLabel.position.set(520, 300);
      view.addChild(motionLabel);

      const rows = new Container();
      view.addChild(rows);

      const shakeLabel = makeText('Screen shake', STYLE.display(30));
      shakeLabel.position.set(520, 600);
      view.addChild(shakeLabel);

      const shakeRow = new Container();
      view.addChild(shakeRow);

      repaint = () => {
        rows.removeChildren().forEach((c) => c.destroy({ children: true }));
        shakeRow.removeChildren().forEach((c) => c.destroy({ children: true }));
        const s = ctx.settings.get();
        MOTIONS.forEach((m, i) => {
          const selected = s.motion === m.id;
          const b = new Button({
            label: m.label,
            width: 220,
            height: 60,
            variant: selected ? 'gold' : 'ghost',
            onPress: () => {
              ctx.settings.set({ motion: m.id });
              repaint();
            },
          });
          b.position.set(520 + 110 + i * 240, 390);
          rows.addChild(b);
          const blurb = makeText(m.blurb, { ...STYLE.body(20), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 210 });
          blurb.anchor.set(0.5, 0);
          blurb.position.set(520 + 110 + i * 240, 440);
          rows.addChild(blurb);
        });
        const shake = new Button({
          label: s.shake ? 'On' : 'Off',
          width: 220,
          height: 60,
          variant: s.shake ? 'gold' : 'ghost',
          onPress: () => {
            ctx.settings.set({ shake: !s.shake });
            repaint();
          },
        });
        shake.position.set(520 + 110, 690);
        shakeRow.addChild(shake);
      };
      repaint();

      const back = new Button({ label: 'Back', variant: 'ghost', width: 240, onPress: () => ctx.router.go('/') });
      back.position.set(DESIGN.width / 2, 900);
      view.addChild(back);
    },
    exit() {},
  };
}
