import { Container, Sprite, type Texture } from 'pixi.js';
import { DESIGN } from '../../app/fit';
import type { BackgroundTextures } from '../../app/art';
import type { Stage } from '../../app/stage';

export type LayerName = 'back' | 'far' | 'mid' | 'near' | 'overlay';

export interface LayerSetting {
  /** Pixels of drift at the edge of the screen. 0 pins the layer still. */
  drift: number;
  /** Oversize, so a drifting layer never shows its edge. */
  scale: number;
  visible: boolean;
}

export type LayerSettings = Record<LayerName, LayerSetting>;

/**
 * The tuned look, back to front. `near` is the ground the enemies stand on, so
 * it does not drift — moving it would slide the floor out from under them.
 */
export const DEFAULT_LAYERS: LayerSettings = {
  back: { drift: 4, scale: 1.02, visible: true },
  far: { drift: 14, scale: 1.04, visible: true },
  mid: { drift: 30, scale: 1.06, visible: true },
  near: { drift: 0, scale: 1, visible: true },
  overlay: { drift: 8, scale: 1.03, visible: true },
};

export function copyLayers(s: LayerSettings): LayerSettings {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v }])) as LayerSettings;
}

/**
 * Background layers that drift against the pointer. Nothing here reads the
 * window; it listens to the stage. The overlay is built but not added — the
 * scene places it above the art and below the UI, wherever that is.
 */
export class ParallaxBackdrop extends Container {
  /** Watercolour marks, for the scene to put in its own stack. */
  readonly overlay: Container | null = null;

  private readonly layers: { name: LayerName; sprite: Sprite }[] = [];
  private settings: LayerSettings;
  private target = { x: 0, y: 0 };
  private readonly tick: () => void;

  constructor(textures: BackgroundTextures, stage: Stage, settings: LayerSettings = DEFAULT_LAYERS) {
    super({ label: 'parallax' });
    this.settings = copyLayers(settings);

    const make = (name: LayerName, tex: Texture | undefined): Sprite | null => {
      if (!tex) return null;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.position.set(DESIGN.width / 2, DESIGN.height / 2);
      this.layers.push({ name, sprite });
      return sprite;
    };
    for (const name of ['back', 'far', 'mid', 'near'] as const) {
      const sprite = make(name, textures[name]);
      if (sprite) this.addChild(sprite);
    }
    const over = make('overlay', textures.overlay);
    if (over) {
      this.overlay = new Container({ label: 'parallax-overlay' });
      this.overlay.eventMode = 'none';
      this.overlay.addChild(over);
    }
    this.apply();

    this.eventMode = 'none';
    stage.app.stage.on('globalpointermove', (e) => {
      const p = stage.root.toLocal(e.global);
      this.target = { x: (p.x / DESIGN.width - 0.5) * 2, y: (p.y / DESIGN.height - 0.5) * 2 };
    });
    this.tick = () => {
      const k = 0.04;
      for (const l of this.layers) {
        const s = this.settings[l.name];
        const toX = DESIGN.width / 2 - this.target.x * s.drift;
        const toY = DESIGN.height / 2 - this.target.y * s.drift * 0.45;
        l.sprite.x += (toX - l.sprite.x) * k;
        l.sprite.y += (toY - l.sprite.y) * k;
      }
    };
    stage.app.ticker.add(this.tick);
    this.once('destroyed', () => stage.app.ticker.remove(this.tick));
  }

  /** Re-read the settings; the dev page tunes these live. */
  set(settings: LayerSettings): void {
    this.settings = copyLayers(settings);
    this.apply();
  }

  private apply(): void {
    for (const l of this.layers) {
      const s = this.settings[l.name];
      l.sprite.scale.set(s.scale);
      l.sprite.visible = s.visible;
    }
  }
}
