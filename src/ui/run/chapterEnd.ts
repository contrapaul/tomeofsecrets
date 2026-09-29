import { chapterHeal, nextChapter } from '../../engine/run/run';
import { DESIGN } from '../../app/fit';
import type { Scene, SceneContext } from '../../app/router';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';
import { heading } from './widgets';

const TITLES: Record<number, string> = { 1: 'The Moss Halls', 2: 'The Drowned Stacks', 3: 'The Binding' };

/**
 * Between chapters: what you just finished, what you healed, and what is next.
 * A beat to breathe, and the only place the run tells you the shape of itself.
 */
export function chapterEndScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['chapterEnd'], ({ view, run, content, sync, next, save }) => {
    const done = run.chapter;
    const healed = Math.round(chapterHeal(run) * 100);
    view.addChild(heading(`${TITLES[done] ?? `Chapter ${done}`} is behind you`, 200, `Chapter ${done} cleared`));

    const lines = [
      `You are at ${run.hero.hp} of ${run.hero.maxHp} health.`,
      `${run.hero.deck.length} cards, ${run.hero.relics.length} relic${run.hero.relics.length === 1 ? '' : 's'}, ${run.hero.gold} gold.`,
      `The way on heals ${healed}% of your health.`,
    ];
    lines.forEach((text, i) => {
      const t = makeText(text, { ...STYLE.body(26), fill: PALETTE.parchmentDim });
      t.anchor.set(0.5, 0);
      t.position.set(DESIGN.width / 2, 400 + i * 44);
      view.addChild(t);
    });

    const ahead = makeText(TITLES[done + 1] ? `Ahead: ${TITLES[done + 1]}` : 'Ahead: the last of it', { ...STYLE.display(34), fill: PALETTE.gold });
    ahead.anchor.set(0.5, 0);
    ahead.position.set(DESIGN.width / 2, 580);
    view.addChild(ahead);

    const on = new Button({
      label: 'Onward',
      width: 300,
      height: 64,
      onPress: () => {
        nextChapter(run, content);
        save();
        sync();
        next();
      },
    });
    on.position.set(DESIGN.width / 2, 740);
    view.addChild(on);
  });
}
