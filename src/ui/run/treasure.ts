import type { Scene, SceneContext } from '../../app/router';
import { leaveTreasure, takeTreasure } from '../../engine/run/run';
import { DESIGN } from '../../app/fit';
import { Button } from '../kit/button';
import { runScene } from './base';
import { heading, relicToken } from './widgets';

export function treasureScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['treasure'], ({ view, run, content, tooltip, sync, next, save }) => {
    const t = run.treasure!;
    view.addChild(heading('Treasure', 160, t.relics.length > 1 ? 'Choose one.' : 'Something left behind on purpose.'));
    t.relics.forEach((id, i) => {
      const token = relicToken(content, id, tooltip, () => {
        takeTreasure(run, content, id);
        save();
        sync();
        leaveTreasure(run);
        next();
      });
      token.position.set(DESIGN.width / 2 + (i - (t.relics.length - 1) / 2) * 260, 500);
      view.addChild(token);
    });
    const leave = new Button({ label: 'Leave it', variant: 'ghost', width: 240, height: 52, onPress: () => { leaveTreasure(run); next(); } });
    leave.position.set(DESIGN.width / 2, 800);
    view.addChild(leave);
  });
}
