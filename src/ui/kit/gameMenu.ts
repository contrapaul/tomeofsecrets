import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { DESIGN } from '../../app/fit';
import type { Router } from '../../app/router';
import { Button } from './button';
import { d } from './motion';
import { PALETTE } from './palette';
import { makeText, STYLE } from './text';

/** The small button that opens the menu. Sits at the left of the top bar. */
export function menuButton(onOpen: () => void): Container {
  const c = new Container({ label: 'menu-button' });
  const g = new Graphics();
  g.roundRect(-38, -20, 76, 40, 8).fill({ color: PALETTE.parchment, alpha: 0.08 }).stroke({ color: PALETTE.gold, width: 2, alpha: 0.7 });
  c.addChild(g);
  const label = makeText('MENU', { ...STYLE.mono(16), fill: PALETTE.parchment, letterSpacing: 1 });
  label.anchor.set(0.5);
  c.addChild(label);
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.on('pointertap', onOpen);
  return c;
}

export interface GameMenuOptions {
  router: Router;
  /** Added above Quit — abandoning a run, for instance. */
  extra?: { label: string; onPress: () => void }[];
  onClose?: () => void;
}

/**
 * The pause menu, reachable from a fight and from every run screen. The engine
 * is turn-based and nothing is running while it is open, so this pauses nothing;
 * it is a way out that does not mean abandoning the run.
 */
export function openGameMenu(host: Container, opts: GameMenuOptions): () => void {
  const overlay = new Container({ label: 'game-menu' });
  const dim = new Graphics();
  dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.72 });
  dim.eventMode = 'static';
  overlay.addChild(dim);

  const close = (): void => {
    dim.eventMode = 'none';
    opts.onClose?.();
    gsap.to(overlay, { alpha: 0, duration: d(0.12), onComplete: () => overlay.destroy({ children: true }) });
  };
  dim.on('pointertap', close);

  const title = makeText('PAUSED', { ...STYLE.display(44), fill: PALETTE.gold });
  title.anchor.set(0.5);
  title.position.set(DESIGN.width / 2, 300);
  overlay.addChild(title);

  const hint = makeText('Your run is saved as you go. Leaving does not lose it.', { ...STYLE.body(22), fill: PALETTE.parchmentDim });
  hint.anchor.set(0.5);
  hint.position.set(DESIGN.width / 2, 360);
  overlay.addChild(hint);

  const rows: { label: string; onPress: () => void; variant?: 'gold' | 'ghost' }[] = [
    { label: 'Resume', onPress: close, variant: 'gold' },
    { label: 'Settings', onPress: () => opts.router.go('/settings') },
    { label: 'How to play', onPress: () => opts.router.go('/knowledge') },
    ...(opts.extra ?? []).map((e) => ({ ...e })),
    { label: 'Quit to title', onPress: () => opts.router.go('/') },
  ];
  rows.forEach((r, i) => {
    const b = new Button({ label: r.label, width: 340, height: 60, variant: r.variant ?? 'ghost', onPress: r.onPress });
    b.position.set(DESIGN.width / 2, 450 + i * 80);
    overlay.addChild(b);
  });

  overlay.alpha = 0;
  host.addChild(overlay);
  gsap.to(overlay, { alpha: 1, duration: d(0.14) });
  return close;
}
