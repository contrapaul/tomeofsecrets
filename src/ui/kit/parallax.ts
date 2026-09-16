import { Container, Sprite, type Texture } from 'pixi.js';
import { DESIGN } from '../../app/fit';
import type { Stage } from '../../app/stage';

/**
 * Two background layers that drift a little against the pointer. The far
 * layer moves least. Nothing here reads the window; it listens to the stage.
 */
export class ParallaxBackdrop extends Container {
  private readonly far: Sprite;
  private readonly near: Sprite | null;
  private target = { x: 0, y: 0 };
  private readonly tick: () => void;

  constructor(textures: { far: Texture; near?: Texture }, private readonly stage: Stage) {
    super({ label: 'parallax' });
    this.far = new Sprite(textures.far);
    this.far.anchor.set(0.5);
    this.far.position.set(DESIGN.width / 2, DESIGN.height / 2);
    this.far.scale.set(1.04);
    this.addChild(this.far);
    this.near = textures.near ? new Sprite(textures.near) : null;
    if (this.near) {
      this.near.anchor.set(0.5);
      this.near.position.set(DESIGN.width / 2, DESIGN.height / 2);
      this.near.scale.set(1.08);
      this.addChild(this.near);
    }
    this.eventMode = 'none';
    stage.app.stage.on('globalpointermove', (e) => {
      const p = stage.root.toLocal(e.global);
      this.target = { x: (p.x / DESIGN.width - 0.5) * 2, y: (p.y / DESIGN.height - 0.5) * 2 };
    });
    this.tick = () => {
      const k = 0.04;
      this.far.x += (DESIGN.width / 2 - this.target.x * 12 - this.far.x) * k;
      this.far.y += (DESIGN.height / 2 - this.target.y * 6 - this.far.y) * k;
      if (this.near) {
        this.near.x += (DESIGN.width / 2 - this.target.x * 34 - this.near.x) * k;
        this.near.y += (DESIGN.height / 2 - this.target.y * 14 - this.near.y) * k;
      }
    };
    stage.app.ticker.add(this.tick);
    this.once('destroyed', () => stage.app.ticker.remove(this.tick));
  }
}
