import type { Scene, SceneContext } from '../../app/router';
import { takeBossRelic } from '../../engine/run/run';
import { DESIGN } from '../../app/fit';
import { runScene } from './base';
import { heading, relicToken } from './widgets';

export function bossRewardScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['bossReward'], ({ view, run, content, tooltip, next, save }) => {
    view.addChild(heading('A boss relic', 160, 'Each one costs something. Choose.'));
    (run.bossRelics ?? []).forEach((id, i, all) => {
      const token = relicToken(content, id, tooltip, () => {
        takeBossRelic(run, content, id);
        save();
        next();
      });
      token.position.set(DESIGN.width / 2 + (i - (all.length - 1) / 2) * 320, 500);
      view.addChild(token);
    });
  });
}
