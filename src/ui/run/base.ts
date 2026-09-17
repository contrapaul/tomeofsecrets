import { Container } from 'pixi.js';
import type { Scene, SceneContext } from '../../app/router';
import { audio } from '../../app/audio';
import { runController } from '../../app/runController';
import type { RunPhase, RunState } from '../../engine/run/run';
import type { ContentRegistry } from '../../content';
import { backdrop } from '../kit/backdrop';
import { Tooltip } from '../kit/tooltip';
import { DeckOverlay, type DeckOverlayOptions } from './DeckOverlay';
import { RunBar } from './RunBar';

export interface RunSceneDeps {
  view: Container;
  run: RunState;
  content: ContentRegistry;
  tooltip: Tooltip;
  bar: RunBar;
  /** Re-read the run into the bar. Call after any engine step. */
  sync(): void;
  /** Save and go wherever the run's phase says. */
  next(): void;
  save(): void;
  showDeck(opts?: Partial<DeckOverlayOptions>): void;
  ctx: SceneContext;
}

/**
 * Every run screen: guards the phase (a reload or a stale link is sent to
 * the right screen), gives the builder a tooltip, the hero bar and the deck.
 */
export function runScene(ctx: SceneContext, phases: RunPhase[], build: (d: RunSceneDeps) => void | Promise<void>, opts: { bar?: boolean; bg?: boolean } = {}): Scene {
  const view = new Container();
  const controller = runController();
  const tooltip = new Tooltip();
  let bar: RunBar | null = null;
  return {
    view,
    async enter() {
      const run = controller.run;
      if (!run || !phases.includes(run.phase)) {
        ctx.router.go(controller.route());
        return;
      }
      audio().music(run.phase === 'won' || run.phase === 'lost' ? null : 'map');
      if (opts.bg !== false) view.addChild(backdrop());
      ctx.stage.overlay.addChild(tooltip);
      const deps: RunSceneDeps = {
        view,
        run,
        content: controller.content,
        tooltip,
        bar: null as unknown as RunBar,
        sync: () => bar?.sync(run),
        next: () => {
          controller.save();
          ctx.router.go(controller.route());
        },
        save: () => controller.save(),
        showDeck: (o) => {
          tooltip.hide();
          const overlay = new DeckOverlay(controller.content, {
            title: 'Your deck',
            cards: run.hero.deck,
            onDone: () => overlay.destroy({ children: true }),
            ...o,
          });
          ctx.stage.overlay.addChild(overlay);
        },
        ctx,
      };
      await build(deps);
      if (opts.bar !== false) {
        bar = new RunBar(controller.content, tooltip, () => deps.showDeck());
        bar.sync(run);
        view.addChild(bar);
        deps.bar = bar;
      }
    },
    exit() {
      tooltip.destroy({ children: true });
    },
  };
}
