import { Graphics, type Container } from 'pixi.js';
import gsap from 'gsap';
import { DESIGN } from './fit';
import type { Stage } from './stage';
import { MOTION_SCALE, type SettingsStore } from './settings';

export interface Route {
  path: string;
  params: URLSearchParams;
}

/** `#/dev/fight?class=mage` → `{ path: '/dev/fight', params }`. Pure. */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [pathPart = '', query = ''] = raw.split('?', 2);
  const trimmed = pathPart.replace(/\/+$/, '');
  const path = trimmed === '' ? '/' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return { path, params: new URLSearchParams(query) };
}

export function toHash(path: string, params?: Record<string, string>): string {
  const q = params ? new URLSearchParams(params).toString() : '';
  return `#${path}${q ? `?${q}` : ''}`;
}

export interface SceneContext {
  stage: Stage;
  settings: SettingsStore;
  router: Router;
}

/** The scene contract. `view` is added to the stage on enter and destroyed on exit. */
export interface Scene {
  readonly view: Container;
  enter(params: URLSearchParams): void | Promise<void>;
  exit(): void | Promise<void>;
  update?(deltaMs: number): void;
}

export type SceneFactory = (ctx: SceneContext) => Scene;

export class Router {
  private readonly routes = new Map<string, SceneFactory>();
  private current: Scene | null = null;
  private currentPath = '';
  private readonly curtain = new Graphics();
  private navigating: Promise<void> = Promise.resolve();

  constructor(private readonly ctx: Omit<SceneContext, 'router'>) {
    this.curtain.rect(0, 0, DESIGN.width, DESIGN.height).fill(0x000000);
    this.curtain.alpha = 0;
    this.curtain.eventMode = 'none';
    ctx.stage.overlay.addChild(this.curtain);
  }

  register(path: string, factory: SceneFactory): this {
    this.routes.set(path, factory);
    return this;
  }

  start(): void {
    window.addEventListener('hashchange', () => this.sync());
    this.sync();
  }

  go(path: string, params?: Record<string, string>): void {
    window.location.hash = toHash(path, params);
  }

  update(deltaMs: number): void {
    this.current?.update?.(deltaMs);
  }

  private sync(): void {
    const route = parseHash(window.location.hash);
    if (!this.routes.has(route.path)) {
      if (route.path !== '/') window.location.replace('#/');
      return;
    }
    this.navigating = this.navigating.then(() => this.switchTo(route));
  }

  private async switchTo(route: Route): Promise<void> {
    const key = `${route.path}?${route.params.toString()}`;
    if (key === this.currentPath && this.current) return;
    const factory = this.routes.get(route.path)!;
    const duration = 0.18 * MOTION_SCALE[this.ctx.settings.get().motion];

    if (this.current) {
      this.curtain.eventMode = 'static'; // swallow input during the swap
      await gsap.to(this.curtain, { alpha: 1, duration, ease: 'power1.in' });
      await this.current.exit();
      this.current.view.destroy({ children: true });
    }

    const next = factory({ ...this.ctx, router: this });
    this.current = next;
    this.currentPath = key;
    this.ctx.stage.addScene(next.view);
    await next.enter(route.params);
    await gsap.to(this.curtain, { alpha: 0, duration, ease: 'power1.out' });
    this.curtain.eventMode = 'none';
  }
}
