import { Application, Container, Graphics, type Text } from 'pixi.js';
import { DESIGN, fit } from './fit';

/**
 * The one canvas and the 1920×1080 design space inside it.
 *
 * Nothing outside this file reads the window size. Scenes are children of
 * `root` and lay out in design pixels; `layout()` scales and centres the
 * whole tree and paints letterbox bars by leaving the canvas background
 * showing around it.
 */
export class Stage {
  /** The design space. Scenes attach here. */
  readonly root = new Container({ label: 'root' });
  /** Above every scene: transitions, toasts, the dev overlay. */
  readonly overlay = new Container({ label: 'overlay' });
  /** Current uniform scale from design pixels to CSS pixels. */
  scale = 1;

  private readonly mask = new Graphics();
  private readonly texts = new Set<Text>();
  private readonly listeners = new Set<(scale: number) => void>();
  private textTimer: number | undefined;

  private constructor(readonly app: Application) {
    this.mask.rect(0, 0, DESIGN.width, DESIGN.height).fill(0xffffff);
    this.root.addChild(this.mask);
    this.root.mask = this.mask;
    this.root.addChild(this.overlay); // scenes are added below this via addScene()
    app.stage.addChild(this.root);
    app.renderer.on('resize', () => this.layout());
    // Belt and braces: some embeds change innerWidth without a resize event.
    app.ticker.add(() => {
      if (app.screen.width !== window.innerWidth || app.screen.height !== window.innerHeight) app.resize();
    });
    this.watchDevicePixelRatio();
    this.layout();
  }

  static async create(letterbox: number): Promise<Stage> {
    const app = new Application();
    await app.init({
      resizeTo: window,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      background: letterbox,
      antialias: true,
      preference: 'webgl',
    });
    document.body.appendChild(app.canvas);
    return new Stage(app);
  }

  /** Scenes go under the overlay so transitions and toasts always win. */
  addScene(view: Container): void {
    this.root.addChildAt(view, this.root.getChildIndex(this.overlay));
  }

  /** Text re-rasterises at `dpr × scale` so it is crisp at every window size. */
  registerText(text: Text): void {
    text.resolution = this.textResolution();
    this.texts.add(text);
    text.once('destroyed', () => this.texts.delete(text));
  }

  onResize(listener: (scale: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private textResolution(): number {
    return (window.devicePixelRatio || 1) * this.scale;
  }

  private layout(): void {
    const { scale, x, y } = fit(this.app.screen.width, this.app.screen.height);
    this.scale = scale;
    this.root.scale.set(scale);
    this.root.position.set(x, y);
    for (const l of this.listeners) l(scale);
    // Re-rasterising every Text on every frame of a window drag is wasteful;
    // settle for a moment, then do it once.
    window.clearTimeout(this.textTimer);
    this.textTimer = window.setTimeout(() => {
      const res = this.textResolution();
      for (const t of this.texts) t.resolution = res;
    }, 120);
  }

  /** Moving the window to a monitor with a different DPR does not fire resize. */
  private watchDevicePixelRatio(): void {
    const watch = () => {
      const dpr = window.devicePixelRatio || 1;
      const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
      mq.addEventListener(
        'change',
        () => {
          this.app.renderer.resolution = window.devicePixelRatio || 1;
          this.app.resize();
          this.layout();
          watch();
        },
        { once: true },
      );
    };
    watch();
  }
}
