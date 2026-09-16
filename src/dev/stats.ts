import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { DESIGN } from '../app/fit';
import type { Scene, SceneContext } from '../app/router';
import { backdrop } from '../ui/kit/backdrop';
import { Button } from '../ui/kit/button';
import { PALETTE } from '../ui/kit/palette';
import { makeText, STYLE } from '../ui/kit/text';

/**
 * #/dev/stats — frame time, scale, DPR, texture count, and a stress toggle
 * that spins a thousand sprites so the numbers mean something.
 */
export function devStatsScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'dev-stats' });
  const sprites: Sprite[] = [];
  let readout: ReturnType<typeof makeText>;
  let frames: number[] = [];
  let worst = 0;

  return {
    view,
    enter() {
      view.addChild(backdrop());
      const title = makeText('DEV · STATS', { ...STYLE.display(40), fill: PALETTE.gold });
      title.position.set(60, 50);
      view.addChild(title);

      readout = makeText('', STYLE.mono(24));
      readout.position.set(60, 130);
      view.addChild(readout);

      const stress = new Button({
        label: 'Stress ×1000',
        variant: 'ghost',
        onPress: () => (sprites.length ? clear() : spawn()),
      });
      stress.position.set(DESIGN.width - 260, 90);
      view.addChild(stress);

      const back = new Button({ label: 'Back', variant: 'ghost', width: 200, onPress: () => ctx.router.go('/') });
      back.position.set(DESIGN.width - 260, 180);
      view.addChild(back);

      // The dev index.
      const links: [string, string, Record<string, string>?][] = [
        ['Fight', '/dev/fight', { class: 'paladin', enemies: 'dummy-brute,dummy-cur' }],
        ['Cards', '/dev/cards', { class: 'all' }],
        ['Enemy preview', '/dev/enemy', { id: 'dummy-brute' }],
        ['Text', '/dev/text'],
        ['Credits', '/credits'],
      ];
      links.forEach(([label, path, params], i) => {
        const b = new Button({ label, variant: 'ghost', width: 260, height: 52, onPress: () => ctx.router.go(path, params) });
        b.position.set(200, 440 + i * 64);
        view.addChild(b);
      });

      const frame = new Graphics();
      frame.rect(1, 1, DESIGN.width - 2, DESIGN.height - 2).stroke({ color: PALETTE.gold, width: 2, alpha: 0.5 });
      view.addChild(frame);
      const corner = makeText('stage edge 1920×1080', { ...STYLE.mono(16), fill: PALETTE.gold });
      corner.anchor.set(1, 1);
      corner.position.set(DESIGN.width - 12, DESIGN.height - 10);
      view.addChild(corner);

      function spawn() {
        const tex = Texture.WHITE;
        for (let i = 0; i < 1000; i++) {
          const s = new Sprite(tex);
          s.tint = [PALETTE.gold, PALETTE.blood, PALETTE.moss, PALETTE.frost, PALETTE.arcane][i % 5]!;
          s.width = s.height = 24;
          s.anchor.set(0.5);
          s.position.set(300 + ((i * 97) % 1300), 300 + ((i * 53) % 700));
          view.addChild(s);
          sprites.push(s);
        }
      }
      function clear() {
        for (const s of sprites) s.destroy();
        sprites.length = 0;
      }
    },
    update(deltaMs) {
      frames.push(deltaMs);
      if (frames.length > 60) frames = frames.slice(-60);
      worst = Math.max(worst * 0.98, deltaMs);
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      const r = ctx.stage.app.renderer;
      const screen = ctx.stage.app.screen;
      readout.text = [
        `fps        ${(1000 / avg).toFixed(0)}`,
        `frame ms   ${avg.toFixed(2)} avg · ${worst.toFixed(1)} worst`,
        `window     ${screen.width}×${screen.height} css px`,
        `dpr        ${r.resolution}`,
        `scale      ${ctx.stage.scale.toFixed(4)}`,
        `text res   ${(r.resolution * ctx.stage.scale).toFixed(2)}`,
        `textures   ${'managedTextures' in r.texture ? r.texture.managedTextures.length : '?'}`,
        `sprites    ${sprites.length}`,
        `renderer   ${r.name}`,
      ].join('\n');
      for (let i = 0; i < sprites.length; i++) sprites[i]!.rotation += 0.02 + (i % 7) * 0.003;
    },
    exit() {},
  };
}
