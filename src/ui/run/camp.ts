import type { Scene, SceneContext } from '../../app/router';
import { canRest, leaveCamp, rest, smith, smithUpgrades, upgradeable } from '../../engine/run/run';
import { DESIGN } from '../../app/fit';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';
import { heading } from './widgets';

/** Camp: Rest or Smith, once. */
export function campScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['camp'], ({ view, run, content, sync, next, save, showDeck }) => {
    view.addChild(heading('Camp', 140, 'A quiet corner between the shelves.'));
    const heal = Math.round(run.hero.maxHp * 0.3);
    const n = smithUpgrades(run, content);

    const restBtn = new Button({
      label: `Rest · heal ${heal}`,
      width: 420,
      height: 80,
      disabled: !canRest(run),
      onPress: () => {
        if (rest(run, content)) {
          save();
          sync();
          leaveCamp(run);
          next();
        }
      },
    });
    restBtn.position.set(DESIGN.width / 2 - 260, 520);
    view.addChild(restBtn);
    const smithBtn = new Button({
      label: n > 1 ? `Smith · upgrade ${n} cards` : 'Smith · upgrade a card',
      width: 420,
      height: 80,
      variant: 'ghost',
      disabled: upgradeable(run).length === 0,
      onPress: () =>
        showDeck({
          title: n > 1 ? `Upgrade ${n} cards` : 'Upgrade a card',
          pick: n,
          eligible: (c) => !c.upgraded,
          preview: 'upgraded',
          onDone: (uids) => {
            ctx.stage.overlay.children.filter((c) => c.label === 'deck').forEach((c) => c.destroy({ children: true }));
            if (uids.length && smith(run, content, uids)) {
              save();
              sync();
              leaveCamp(run);
              next();
            }
          },
        }),
    });
    smithBtn.position.set(DESIGN.width / 2 + 260, 520);
    view.addChild(smithBtn);
    const note = makeText(canRest(run) ? 'Choose one.' : 'The Cursed Tome will not let you rest. Smith instead.', { ...STYLE.body(24), fill: PALETTE.parchmentDim });
    note.anchor.set(0.5);
    note.position.set(DESIGN.width / 2, 640);
    view.addChild(note);
    const leave = new Button({ label: 'Move on', variant: 'ghost', width: 240, height: 52, onPress: () => { leaveCamp(run); next(); } });
    leave.position.set(DESIGN.width / 2, 820);
    view.addChild(leave);
  });
}
