import { Container } from 'pixi.js';
import type { Scene, SceneContext } from '../../app/router';
import { runController } from '../../app/runController';
import { DESIGN } from '../../app/fit';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';
import { heading } from './widgets';

/** Won or lost: the summary, the seed, and the way back. */
export function runEndScene(ctx: SceneContext): Scene {
  return runScene(
    ctx,
    ['won', 'lost'],
    ({ view, run, content }) => {
      const won = run.phase === 'won';
      view.addChild(heading(won ? 'Victory' : 'Defeat', 120, won ? 'The Moss Halls are behind you.' : run.stats.deathBy ? `Slain by ${content.enemies[run.stats.deathBy.enemy]?.name ?? run.stats.deathBy.enemy}.` : 'The run ends here.'));
      const lines = [
        `Floor ${run.stats.floorsClimbed} of chapter ${run.chapter}`,
        `${run.stats.fights} fights · ${run.stats.elites} elites · ${run.stats.bosses} bosses`,
        `${run.hero.deck.length} cards · ${run.hero.relics.length} relics · ${run.hero.gold} gold`,
        `seed ${run.seed}`,
      ];
      const box = new Container();
      lines.forEach((l, i) => {
        const t = makeText(l, { ...STYLE.body(28), fill: i === lines.length - 1 ? PALETTE.parchmentDim : PALETTE.parchment });
        t.anchor.set(0.5);
        t.position.set(0, i * 48);
        box.addChild(t);
      });
      box.position.set(DESIGN.width / 2, 340);
      view.addChild(box);
      const kills = Object.entries(run.stats.kills).sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (kills.length) {
        const k = makeText(`Slain: ${kills.map(([id, n]) => `${content.enemies[id]?.name ?? id} ×${n}`).join(', ')}`, { ...STYLE.body(22), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 1100, align: 'center' });
        k.anchor.set(0.5, 0);
        k.position.set(DESIGN.width / 2, 560);
        view.addChild(k);
      }
      const again = new Button({ label: 'New Run', onPress: () => { runController().clear(); ctx.router.go('/run/new'); } });
      again.position.set(DESIGN.width / 2, 760);
      view.addChild(again);
      const title = new Button({ label: 'Title', variant: 'ghost', onPress: () => { runController().clear(); ctx.router.go('/'); } });
      title.position.set(DESIGN.width / 2, 860);
      view.addChild(title);
    },
    { bar: false },
  );
}
