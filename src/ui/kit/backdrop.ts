import { FillGradient, Graphics } from 'pixi.js';
import { DESIGN } from '../../app/fit';
import { PALETTE } from './palette';

/** A full-stage dark background with a soft vignette. The placeholder until real art. */
export function backdrop(top = PALETTE.inkLight, bottom = PALETTE.ink): Graphics {
  const g = new Graphics({ label: 'backdrop' });
  const vertical = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: top },
      { offset: 1, color: bottom },
    ],
  });
  g.rect(0, 0, DESIGN.width, DESIGN.height).fill(vertical);

  // Transparent centre, dark edges.
  const vignette = new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.45 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.45 },
    outerRadius: 0.75,
    colorStops: [
      { offset: 0, color: 'rgba(0,0,0,0)' },
      { offset: 0.6, color: 'rgba(0,0,0,0)' },
      { offset: 1, color: 'rgba(0,0,0,0.75)' },
    ],
  });
  g.rect(0, 0, DESIGN.width, DESIGN.height).fill(vignette);
  g.eventMode = 'none';
  return g;
}
