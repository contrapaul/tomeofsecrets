import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../../app/fit';
import type { Scene, SceneContext } from '../../app/router';
import type { Artwork, EnemyPace, Motion } from '../../app/settings';
import { resetTutorials } from '../../app/tutorial';
import { backdrop } from '../kit/backdrop';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';

const ARTWORKS: { id: Artwork; label: string; blurb: string }[] = [
  { id: 'illustrated', label: 'Illustrated', blurb: 'Drawn by Mr K and the class, as it arrives.' },
  { id: 'placeholder', label: 'Alpha', blurb: 'The generated shapes the game was built against.' },
];

const PACES: { id: EnemyPace; label: string; blurb: string }[] = [
  { id: 'measured', label: 'Measured', blurb: 'The enemies take their time, so you can see what each one does.' },
  { id: 'fast', label: 'Fast', blurb: 'Their turn runs at your speed. For players who know the enemies.' },
];

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
      title.position.set(DESIGN.width / 2, 70);
      view.addChild(title);

      const panel = new Graphics();
      panel.roundRect(460, 170, 1000, 790, 16).fill({ color: PALETTE.parchment, alpha: 0.06 }).stroke({ color: PALETTE.gold, width: 2, alpha: 0.5 });
      view.addChild(panel);

      const heading = (label: string, x: number, y: number) => {
        const t = makeText(label, STYLE.display(30));
        t.position.set(x, y);
        view.addChild(t);
      };
      heading('Motion', 520, 200);
      heading('Enemy turn', 520, 420);
      heading('Artwork', 520, 620);
      heading('Tutorial', 520, 820);
      heading('Music', 1000, 420);
      heading('Sound', 1000, 600);
      heading('Shake', 1000, 760);
      heading('End turn', 1245, 760);
      // No files have been recorded yet; the sliders work, they just have nothing to play.
      for (const y of [420, 600]) {
        const soon = makeText('coming soon', { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
        soon.position.set(1130, y + 10);
        soon.alpha = 0.7;
        view.addChild(soon);
      }

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
          b.position.set(520 + 110 + i * 240, 290);
          rows.addChild(b);
          const blurb = makeText(m.blurb, { ...STYLE.body(20), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 210 });
          blurb.anchor.set(0.5, 0);
          blurb.position.set(520 + 110 + i * 240, 340);
          rows.addChild(blurb);
        });
        PACES.forEach((p, i) => {
          const on = s.enemyPace === p.id;
          const b = new Button({
            label: p.label,
            width: 220,
            height: 60,
            variant: on ? 'gold' : 'ghost',
            onPress: () => {
              ctx.settings.set({ enemyPace: p.id });
              repaint();
            },
          });
          b.position.set(520 + 110 + i * 240, 500);
          rows.addChild(b);
        });
        const paceBlurb = makeText(PACES.find((p) => p.id === s.enemyPace)!.blurb, { ...STYLE.body(19), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 450 });
        paceBlurb.position.set(520, 545);
        rows.addChild(paceBlurb);

        const auto = new Button({
          label: s.autoEndTurn ? 'On' : 'Off',
          width: 200,
          height: 60,
          variant: s.autoEndTurn ? 'gold' : 'ghost',
          onPress: () => {
            ctx.settings.set({ autoEndTurn: !s.autoEndTurn });
            repaint();
          },
        });
        auto.position.set(1350, 822);
        rows.addChild(auto);
        const autoBlurb = makeText('Ends your turn once your energy is gone and nothing in your hand can be played.', { ...STYLE.body(18), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 460 });
        autoBlurb.position.set(1000, 866);
        rows.addChild(autoBlurb);

        ARTWORKS.forEach((a, i) => {
          const on = s.artwork === a.id;
          const b = new Button({
            label: a.label,
            width: 220,
            height: 60,
            // The same button as Motion and Enemy turn; "Illustrated" just needs a smaller word.
            fontSize: 25,
            variant: on ? 'gold' : 'ghost',
            onPress: () => {
              ctx.settings.set({ artwork: a.id });
              repaint();
            },
          });
          b.position.set(520 + 110 + i * 240, 700);
          rows.addChild(b);
        });
        const artBlurb = makeText(`${ARTWORKS.find((a) => a.id === s.artwork)!.blurb} Takes effect on the next fight.`, { ...STYLE.body(20), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 420 });
        artBlurb.position.set(520, 745);
        rows.addChild(artBlurb);

        const shake = new Button({
          label: s.shake ? 'On' : 'Off',
          width: 200,
          height: 60,
          variant: s.shake ? 'gold' : 'ghost',
          onPress: () => {
            ctx.settings.set({ shake: !s.shake });
            repaint();
          },
        });
        shake.position.set(1110, 822);
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
        replay.position.set(630, 882);
        rows.addChild(replay);
        const hint = makeText('The map and first-fight walkthroughs play again on the next run.', { ...STYLE.body(16), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 430 });
        hint.position.set(520, 926);
        rows.addChild(hint);

        levelRow(s.volume.music, 1000, 500, (v) => {
          ctx.settings.set({ volume: { ...s.volume, music: v } });
          repaint();
        });
        levelRow(s.volume.sfx, 1000, 680, (v) => {
          ctx.settings.set({ volume: { ...s.volume, sfx: v } });
          repaint();
        });
      };
      repaint();

      const back = new Button({ label: 'Back', variant: 'ghost', width: 240, onPress: () => ctx.router.go('/') });
      back.position.set(DESIGN.width / 2, 1010);
      view.addChild(back);
    },
    exit() {},
  };
}
