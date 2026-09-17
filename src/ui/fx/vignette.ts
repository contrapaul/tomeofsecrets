import { Sprite, Texture } from 'pixi.js';
import { DESIGN } from '../../app/fit';

/**
 * A full-screen white vignette, transparent in the middle, for tinting and
 * flashing when the hero is hit. Drawn on a small canvas because Pixi's own
 * radial gradient cannot fade to transparent.
 */
export function vignetteSprite(): Sprite {
  const w = 480;
  const h = 270;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  // Stretch a circle into the 16:9 frame so the fade follows the edges.
  c.save();
  c.scale(w / 2, h / 2);
  const g = c.createRadialGradient(1, 1, 0, 1, 1, 1.35);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  c.fillStyle = g;
  c.fillRect(0, 0, 2, 2);
  c.restore();
  const s = new Sprite(Texture.from(canvas));
  s.width = DESIGN.width;
  s.height = DESIGN.height;
  s.alpha = 0;
  s.eventMode = 'none';
  return s;
}
