import { Graphics, type Container } from 'pixi.js';
import gsap from 'gsap';
import { d, done } from '../kit/motion';
import { PALETTE } from '../kit/palette';

/**
 * How hard a hit should feel, 0..1. Every impact effect (knockback, screen
 * shake, the red flash) scales from this one number so they agree with each
 * other. HP damage drives it; a fully blocked hit is a small thud.
 */
export function hitIntensity(hpDamage: number, blocked = 0): number {
  if (hpDamage <= 0) return blocked > 0 ? 0.12 : 0;
  return Math.min(1, 0.2 + hpDamage / 25);
}

/** A burst of spikes and a flash at the point of impact, sized by intensity. */
export function impactBurst(layer: Container, x: number, y: number, intensity: number): Promise<void> {
  const g = new Graphics();
  const size = 36 + 70 * intensity;
  const spikes = 6 + Math.round(4 * intensity);
  const base = Math.random() * Math.PI;
  for (let i = 0; i < spikes; i++) {
    const a = base + (i / spikes) * Math.PI * 2;
    const len = size * (0.7 + Math.random() * 0.6);
    const w = 4 + 6 * intensity;
    g.poly([
      Math.cos(a) * len, Math.sin(a) * len,
      Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w,
      Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w,
    ]).fill({ color: i % 2 ? PALETTE.goldBright : 0xffffff, alpha: 0.9 });
  }
  g.circle(0, 0, size * 0.28).fill({ color: 0xffffff, alpha: 0.95 });
  g.position.set(x, y);
  g.scale.set(0.3);
  g.rotation = Math.random() * 0.6;
  layer.addChild(g);
  const tl = gsap.timeline({ onComplete: () => g.destroy() });
  tl.to(g.scale, { x: 1, y: 1, duration: d(0.1), ease: 'power3.out' }, 0)
    .to(g, { rotation: g.rotation + 0.35, duration: d(0.22), ease: 'power2.out' }, 0)
    .to(g, { alpha: 0, duration: d(0.16), ease: 'power2.in' }, d(0.06));
  return done(tl);
}
