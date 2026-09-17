import { Container } from 'pixi.js';
import type { Scene, SceneContext } from '../../app/router';
import { audio } from '../../app/audio';
import { runController } from '../../app/runController';
import { tutorialPending } from '../../app/tutorial';
import { combatScene } from '../scenes/combat';

/** #/run/fight — the run's current fight, resumed from the save if it was mid-way. */
export function runFightScene(ctx: SceneContext): Scene {
  const controller = runController();
  const run = controller.run;
  if (!run || run.phase !== 'fight' || !run.fight) {
    return {
      view: new Container(),
      enter() {
        ctx.router.go(controller.route());
      },
      exit() {},
    };
  }
  const fight = run.fight;
  audio().music(fight.kind === 'boss' ? 'boss' : fight.kind === 'elite' ? 'elite' : run.chapter > 1 ? `fight-${run.chapter}` : 'fight');
  return combatScene(ctx, controller.content, {
    hero: { classId: run.hero.classId, maxHp: run.hero.maxHp, deck: [] },
    encounter: { enemies: fight.encounter },
    seed: fight.state.seed,
    resume: fight.state,
    background: `chapter${run.chapter}`,
    quietEnd: true,
    tips: tutorialPending('fight'),
    onStep: () => controller.save(),
    onEnd: () => {
      controller.finishFight();
      setTimeout(() => ctx.router.go(controller.route()), 900);
    },
  });
}
