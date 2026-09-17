import { Container, Graphics } from 'pixi.js';
import type { Scene, SceneContext } from '../../app/router';
import { finishReward, skipCard, takeCard, takeRewardRelic, takeVial } from '../../engine/run/run';
import { DESIGN } from '../../app/fit';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';
import { heading, offerCard, relicToken, vialToken } from './widgets';

/** After a fight: gold (taken on leaving), one of three cards, a relic from elites, sometimes a vial. */
export function rewardScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['reward'], ({ view, run, content, tooltip, sync, next, save }) => {
    const r = run.reward!;
    view.addChild(heading(r.kind === 'boss' ? 'The chapter is yours' : r.kind === 'elite' ? 'Elite defeated' : 'Victory', 110, `+${r.gold} gold`));

    const row = new Container();
    view.addChild(row);
    const cards = new Container();
    view.addChild(cards);

    const refresh = () => {
      row.removeChildren().forEach((c) => c.destroy({ children: true }));
      cards.removeChildren().forEach((c) => c.destroy({ children: true }));
      let x = DESIGN.width / 2 - ((r.relic && !r.relicTaken ? 1 : 0) + (r.vial && !r.vialTaken ? 1 : 0) - 1) * 90;
      if (r.relic && !r.relicTaken) {
        const t = relicToken(content, r.relic, tooltip, () => {
          takeRewardRelic(run, content);
          save();
          sync();
          refresh();
        });
        t.position.set(x, 300);
        row.addChild(t);
        x += 180;
      }
      if (r.vial && !r.vialTaken) {
        const t = vialToken(content, r.vial, tooltip, () => {
          if (!takeVial(run)) {
            tooltip.show('', 'No free vial slot.', x, 260, 0);
            setTimeout(() => tooltip.hide(), 1200);
            return;
          }
          save();
          sync();
          refresh();
        });
        t.position.set(x, 300);
        row.addChild(t);
      }
      if (!r.cardTaken) {
        const label = makeText('Choose a card', { ...STYLE.display(26), fill: PALETTE.parchmentDim });
        label.anchor.set(0.5);
        label.position.set(DESIGN.width / 2, 440);
        cards.addChild(label);
        r.cards.forEach((id, i) => {
          const cv = offerCard(content, id, i, 0.95, () => {
            takeCard(run, content, id);
            save();
            sync();
            refresh();
          });
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
