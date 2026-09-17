import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../../app/fit';
import type { Scene, SceneContext } from '../../app/router';
import type { Motion } from '../../app/settings';
import { resetTutorials } from '../../app/tutorial';
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
  let tutorialsReset = false;

  return {
    view,
    enter() {
      view.addChild(backdrop());
      const title = makeText('SETTINGS', { ...STYLE.display(64), fill: PALETTE.gold });
      title.anchor.set(0.5, 0);
      title.position.set(DESIGN.width / 2, 120);
      view.addChild(title);

      const panel = new Graphics();
      panel.roundRect(460, 220, 1000, 680, 16).fill({ color: PALETTE.parchment, alpha: 0.06 }).stroke({ color: PALETTE.gold, width: 2, alpha: 0.5 });
      view.addChild(panel);

      const heading = (label: string, x: number, y: number) => {
        const t = makeText(label, STYLE.display(30));
        t.position.set(x, y);
        view.addChild(t);
      };
      heading('Motion', 520, 250);
      heading('Screen shake', 520, 500);
      heading('Tutorial', 520, 640);
      heading('Music', 1000, 500);
      heading('Sound', 1000, 640);

      const rows = new Container();
      view.addChild(rows);

      const levels = [0, 0.33, 0.66, 1];
      const levelRow = (value: number, x: number, y: number, set: (v: number) => void) => {
        const nearest = levels.reduce((best, l) => (Math.abs(l - value) < Math.abs(best - value) ? l : best), levels[0]!);
        ['Off', 'Low', 'Mid', 'Full'].forEach((label, i) => {
          const selected = nearest === levels[i];
          const b = new Button({ label, width: 100, height: 52, fontSize: 22, variant: selected ? 'gold' : 'ghost', onPress: () => set(levels[i]!) });
          b.position.set(x + 50 + i * 110, y);
          rows.addChild(b);
        });
      };

      repaint = () => {
        rows.removeChildren().forEach((c) => c.destroy({ children: true }));
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
          b.position.set(520 + 110 + i * 240, 340);
          rows.addChild(b);
          const blurb = makeText(m.blurb, { ...STYLE.body(20), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 210 });
          blurb.anchor.set(0.5, 0);
          blurb.position.set(520 + 110 + i * 240, 390);
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
        shake.position.set(520 + 110, 580);
        rows.addChild(shake);

        const replay = new Button({
          label: tutorialsReset ? 'Will replay' : 'Replay',
          width: 220,
          height: 60,
          variant: 'ghost',
          onPress: () => {
            resetTutorials();
            tutorialsReset = true;
            repaint();
          },
        });
        replay.position.set(520 + 110, 720);
        rows.addChild(replay);
        const hint = makeText('The map and first-fight walkthroughs play again on the next run.', { ...STYLE.body(18), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 420 });
        hint.position.set(520, 770);
        rows.addChild(hint);

        levelRow(s.volume.music, 1000, 580, (v) => {
          ctx.settings.set({ volume: { ...s.volume, music: v } });
          repaint();
        });
        levelRow(s.volume.sfx, 1000, 720, (v) => {
          ctx.settings.set({ volume: { ...s.volume, sfx: v } });
          repaint();
        });
      };
      repaint();

      const back = new Button({ label: 'Back', variant: 'ghost', width: 240, onPress: () => ctx.router.go('/') });
      back.position.set(DESIGN.width / 2, 970);
      view.addChild(back);
    },
    exit() {},
  };
}
