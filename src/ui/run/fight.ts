import { Container } from 'pixi.js';
import type { Scene, SceneContext } from '../../app/router';
import { runController } from '../../app/runController';
import { finishFight } from '../../engine/run/run';
import { combatScene } from '../scenes/combat';

/** True once per browser: the three tips play on the very first fight. */
function firstFightTips(): boolean {
  try {
    if (window.localStorage.getItem('tome.tips.v1')) return false;
    window.localStorage.setItem('tome.tips.v1', '1');
    return true;
  } catch {
    return false;
  }
}

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
  const tips = firstFightTips();
  return combatScene(ctx, controller.content, {
    hero: { classId: run.hero.classId, maxHp: run.hero.maxHp, deck: [] },
    encounter: { enemies: fight.encounter },
    seed: fight.state.seed,
    resume: fight.state,
    background: `chapter${run.chapter}`,
    quietEnd: true,
    tips,
    onStep: () => controller.save(),
    onEnd: () => {
      finishFight(run, controller.content);
      controller.save();
      setTimeout(() => ctx.router.go(controller.route()), 900);
    },
  });
}
