import { Container, Sprite, type Texture } from 'pixi.js';
import { DESIGN } from '../../app/fit';
import type { Stage } from '../../app/stage';

/**
 * Up to three background layers that drift a little against the pointer:
 * far (least), mid, near (most). Nothing here reads the window; it listens
 * to the stage.
 */
export class ParallaxBackdrop extends Container {
  private readonly layers: { sprite: Sprite; dx: number; dy: number }[] = [];
  private target = { x: 0, y: 0 };
  private readonly tick: () => void;

  constructor(textures: { far: Texture; mid?: Texture; near?: Texture }, private readonly stage: Stage) {
    super({ label: 'parallax' });
    const add = (tex: Texture | undefined, scale: number, dx: number, dy: number) => {
      if (!tex) return;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.position.set(DESIGN.width / 2, DESIGN.height / 2);
      sprite.scale.set(scale);
      this.addChild(sprite);
      this.layers.push({ sprite, dx, dy });
    };
    add(textures.far, 1.04, 12, 6);
    add(textures.mid, 1.06, 22, 10);
    add(textures.near, 1.08, 34, 14);
    this.eventMode = 'none';
    stage.app.stage.on('globalpointermove', (e) => {
      const p = stage.root.toLocal(e.global);
      this.target = { x: (p.x / DESIGN.width - 0.5) * 2, y: (p.y / DESIGN.height - 0.5) * 2 };
    });
    this.tick = () => {
      const k = 0.04;
      for (const l of this.layers) {
        l.sprite.x += (DESIGN.width / 2 - this.target.x * l.dx - l.sprite.x) * k;
        l.sprite.y += (DESIGN.height / 2 - this.target.y * l.dy - l.sprite.y) * k;
      }
    };
    stage.app.ticker.add(this.tick);
    this.once('destroyed', () => stage.app.ticker.remove(this.tick));
  }
}
