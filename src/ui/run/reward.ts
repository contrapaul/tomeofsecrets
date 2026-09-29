import { Container, Graphics } from 'pixi.js';
import type { Scene, SceneContext } from '../../app/router';
import { audio } from '../../app/audio';
import { finishReward, skipCard, takeCard, takeRewardRelic, takeVial } from '../../engine/run/run';
import { DESIGN } from '../../app/fit';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';
import { heading, offerCard, relicToken, vialToken } from './widgets';

/** After a fight: gold (taken on leaving), one of three cards, a relic from elites, sometimes a vial. */
export function rewardScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['reward'], ({ view, run, content, tooltip, explainer, sync, next, save }) => {
    const r = run.reward!;
    view.addChild(heading(r.kind === 'boss' ? 'The chapter is yours' : r.kind === 'elite' ? 'Elite defeated' : 'Victory', 110, `+${r.gold} gold`));

    const row = new Container();
    view.addChild(row);
    const cards = new Container();
    view.addChild(cards);

    const refresh = () => {
      row.removeChildren().forEach((c) => c.destroy({ children: true }));
      cards.removeChildren().forEach((c) => c.destroy({ children: true }));
      // Taken ones stay on screen: the player should see what they just won, not an
      // empty space where it was. Only a vial with nowhere to go still wants a click.
      const caption = (text: string, cx: number, cy: number) => {
        const t = makeText(text, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
        t.anchor.set(0.5, 0);
        t.position.set(cx, cy);
        row.addChild(t);
      };
      let x = DESIGN.width / 2 - ((r.relic ? 1 : 0) + (r.vial ? 1 : 0) - 1) * 120;
      if (r.relic) {
        const t = relicToken(content, r.relic, tooltip, r.relicTaken ? undefined : () => {
          takeRewardRelic(run, content);
          save();
          sync();
          refresh();
        }, explainer);
        t.position.set(x, 300);
        row.addChild(t);
        if (r.relicTaken) caption('taken', x, 384);
        x += 240;
      }
      if (r.vial) {
        const t = vialToken(content, r.vial, tooltip, r.vialTaken ? undefined : () => {
          if (!takeVial(run)) {
            tooltip.show('', 'No free vial slot.', x, 260, 0);
            setTimeout(() => tooltip.hide(), 1200);
            return;
          }
          save();
          sync();
          refresh();
        }, explainer);
        t.position.set(x, 300);
        row.addChild(t);
        caption(r.vialTaken ? 'taken' : 'no free slot', x, 372);
      }
      if (!r.cardTaken) {
        const label = makeText('Choose a card', { ...STYLE.display(26), fill: PALETTE.parchmentDim });
        label.anchor.set(0.5);
        label.position.set(DESIGN.width / 2, 440);
        cards.addChild(label);
        r.cards.forEach((id, i) => {
          const cv = offerCard(content, id, i, 0.95, () => {
            audio().play('card-pick');
            takeCard(run, content, id);
            save();
            sync();
            refresh();
          }, explainer);
          if (!cv) return;
          cv.position.set(DESIGN.width / 2 + (i - 1) * 300, 660);
          cards.addChild(cv);
        });
        const skip = new Button({ label: 'Skip card', variant: 'ghost', width: 220, height: 52, onPress: () => { skipCard(run); save(); refresh(); } });
        skip.position.set(DESIGN.width / 2, 890);
        cards.addChild(skip);
      } else {
        const done = makeText('Card taken.', { ...STYLE.body(26), fill: PALETTE.parchmentDim });
        done.anchor.set(0.5);
        done.position.set(DESIGN.width / 2, 600);
        cards.addChild(done);
      }
    };
    refresh();

    const proceed = new Button({ label: 'Continue', onPress: () => { finishReward(run, content); next(); } });
    proceed.position.set(DESIGN.width / 2, DESIGN.height - 70);
    view.addChild(proceed);
    const line = new Graphics();
    line.rect(DESIGN.width / 2 - 500, 400, 1000, 1).fill({ color: PALETTE.gold, alpha: 0.3 });
    view.addChild(line);
  });
}
