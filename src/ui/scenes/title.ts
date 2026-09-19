import { Container } from 'pixi.js';
import gsap from 'gsap';
import { DESIGN } from '../../app/fit';
import type { Scene, SceneContext } from '../../app/router';
import { MOTION_SCALE } from '../../app/settings';
import { backdrop } from '../kit/backdrop';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { audio } from '../../app/audio';
import { profileStore } from '../../app/profile';
import { runController } from '../../app/runController';

export function titleScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'title' });

  return {
    view,
    enter() {
      audio().music('title');
      view.addChild(backdrop());

      const wordmark = makeText('TOME OF SECRETS', { ...STYLE.display(96), fill: PALETTE.gold, letterSpacing: 10 });
      wordmark.anchor.set(0.5);
      wordmark.position.set(DESIGN.width / 2, 300);
      view.addChild(wordmark);

      const tagline = makeText('A deckbuilding roguelike game.', {
        ...STYLE.body(30),
        fontStyle: 'italic',
        fill: PALETTE.parchmentDim,
      });
      tagline.anchor.set(0.5);
      tagline.position.set(DESIGN.width / 2, 390);
      view.addChild(tagline);

      const controller = runController();
      const buttons = [
        ...(controller.hasSave() ? [new Button({ label: 'Continue', onPress: () => ctx.router.go(controller.route()) })] : []),
        new Button({ label: 'New Run', variant: controller.hasSave() ? 'ghost' : 'gold', onPress: () => ctx.router.go('/run/new') }),
        new Button({ label: 'The Tome', variant: 'ghost', onPress: () => ctx.router.go('/tome') }),
        new Button({ label: 'Settings', variant: 'ghost', onPress: () => ctx.router.go('/settings') }),
        new Button({ label: 'Credits', variant: 'ghost', onPress: () => ctx.router.go('/credits') }),
        // A plain page beside the game: sizes, formats, tips, what is wanted.
        new Button({ label: 'Help build this', variant: 'ghost', onPress: () => window.open('/contribute/index.html', '_blank', 'noopener') }),
      ];
      const step = buttons.length > 5 ? 82 : 90;
      buttons.forEach((b, i) => {
        b.position.set(DESIGN.width / 2, 500 + i * step);
        view.addChild(b);
      });

      const version = makeText(`v0.0.1 · phase 6 · ${profileStore().profile.lore} lore`, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
      version.alpha = 0.6;
      version.position.set(24, DESIGN.height - 40);
      view.addChild(version);

      const dev = makeText('dev', { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
      dev.alpha = 0.35;
      dev.anchor.set(1, 0);
      dev.position.set(DESIGN.width - 24, DESIGN.height - 40);
      dev.eventMode = 'static';
      dev.cursor = 'pointer';
      dev.on('pointertap', () => ctx.router.go('/dev/stats'));
      view.addChild(dev);

      // A quiet entrance.
      const k = MOTION_SCALE[ctx.settings.get().motion];
      gsap.from([wordmark, tagline], { alpha: 0, y: '-=20', duration: 0.6 * k, stagger: 0.12 * k, ease: 'power2.out' });
      gsap.from(buttons, { alpha: 0, y: '+=16', duration: 0.4 * k, stagger: 0.08 * k, delay: 0.3 * k, ease: 'power2.out' });
    },
    exit() {},
  };
}
