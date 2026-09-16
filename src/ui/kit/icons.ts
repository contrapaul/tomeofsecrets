import { Graphics } from 'pixi.js';

/**
 * Stroke icons drawn with Graphics so they scale crisp and tint freely.
 * All are drawn in a 24×24 box centred on (0, 0).
 */
export type IconName = 'sword' | 'shield' | 'up' | 'down' | 'question' | 'skull' | 'summon' | 'star' | 'trap' | 'paw';

export function icon(name: IconName, color = 0xffffff, size = 24, width = 2.2): Graphics {
  const g = new Graphics();
  const s = size / 24;
  const stroke = { color, width: width * s, cap: 'round' as const, join: 'round' as const };
  const p = (x: number, y: number): [number, number] => [(x - 12) * s, (y - 12) * s];
  switch (name) {
    case 'sword':
      g.moveTo(...p(4, 20)).lineTo(...p(18, 6)).stroke(stroke);
      g.moveTo(...p(14, 6)).lineTo(...p(18, 6)).lineTo(...p(18, 10)).stroke(stroke);
      g.moveTo(...p(6, 14)).lineTo(...p(10, 18)).stroke(stroke);
      break;
    case 'shield':
      g.moveTo(...p(12, 3)).lineTo(...p(19, 6)).lineTo(...p(19, 12)).bezierCurveTo(...p(19, 16), ...p(16, 19), ...p(12, 21))
        .bezierCurveTo(...p(8, 19), ...p(5, 16), ...p(5, 12)).lineTo(...p(5, 6)).closePath().stroke(stroke);
      break;
    case 'up':
      g.moveTo(...p(12, 20)).lineTo(...p(12, 6)).stroke(stroke);
      g.moveTo(...p(6, 12)).lineTo(...p(12, 6)).lineTo(...p(18, 12)).stroke(stroke);
      break;
    case 'down':
      g.moveTo(...p(12, 4)).lineTo(...p(12, 18)).stroke(stroke);
      g.moveTo(...p(6, 12)).lineTo(...p(12, 18)).lineTo(...p(18, 12)).stroke(stroke);
      break;
    case 'question':
      g.moveTo(...p(9, 9)).bezierCurveTo(...p(9, 6), ...p(15, 6), ...p(15, 9)).bezierCurveTo(...p(15, 11), ...p(12, 11.5), ...p(12, 14)).stroke(stroke);
      g.moveTo(...p(12, 18)).lineTo(...p(12, 18.5)).stroke({ ...stroke, width: width * s * 1.6 });
      break;
    case 'skull':
      g.circle(...p(12, 10), 7 * s).stroke(stroke);
      g.circle(...p(9.5, 10), 1.4 * s).fill(color);
      g.circle(...p(14.5, 10), 1.4 * s).fill(color);
      g.moveTo(...p(9, 17)).lineTo(...p(9, 20)).moveTo(...p(12, 17)).lineTo(...p(12, 20)).moveTo(...p(15, 17)).lineTo(...p(15, 20)).stroke(stroke);
      break;
    case 'summon':
      g.circle(...p(12, 12), 3 * s).stroke(stroke);
      g.circle(...p(5, 6), 2 * s).stroke(stroke);
      g.circle(...p(19, 6), 2 * s).stroke(stroke);
      g.circle(...p(12, 20), 2 * s).stroke(stroke);
      break;
    case 'star':
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const b = a + Math.PI / 5;
        const [ox, oy] = [12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9];
        const [ix, iy] = [12 + Math.cos(b) * 4, 12 + Math.sin(b) * 4];
        if (i === 0) g.moveTo(...p(ox, oy));
        else g.lineTo(...p(ox, oy));
        g.lineTo(...p(ix, iy));
      }
      g.closePath().stroke(stroke);
      break;
    case 'trap':
      g.moveTo(...p(4, 14)).lineTo(...p(8, 8)).lineTo(...p(12, 14)).lineTo(...p(16, 8)).lineTo(...p(20, 14)).stroke(stroke);
      g.moveTo(...p(4, 18)).lineTo(...p(20, 18)).stroke(stroke);
      break;
    case 'paw':
      g.circle(...p(12, 15), 4 * s).stroke(stroke);
      g.circle(...p(6, 9), 2 * s).stroke(stroke);
      g.circle(...p(10, 5), 2 * s).stroke(stroke);
      g.circle(...p(14, 5), 2 * s).stroke(stroke);
      g.circle(...p(18, 9), 2 * s).stroke(stroke);
      break;
  }
  return g;
}
