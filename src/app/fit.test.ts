import { describe, expect, it } from 'vitest';
import { DESIGN, fit } from './fit';

describe('fit', () => {
  it('fills a 16:9 window exactly with no offset', () => {
    expect(fit(1920, 1080)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(fit(3840, 2160)).toEqual({ scale: 2, x: 0, y: 0 });
    expect(fit(1280, 720)).toEqual({ scale: 720 / 1080, x: 0, y: 0 });
  });

  it('letterboxes a wider window on the sides', () => {
    const f = fit(2560, 1080);
    expect(f.scale).toBe(1);
    expect(f.x).toBe(320);
    expect(f.y).toBe(0);
  });

  it('letterboxes a taller window top and bottom', () => {
    const f = fit(1920, 1500);
    expect(f.scale).toBe(1);
    expect(f.x).toBe(0);
    expect(f.y).toBe(210);
  });

  it('never exceeds either window dimension', () => {
    const windows: [number, number][] = [[300, 900], [900, 300], [1366, 768], [1024, 1366], [1, 1]];
    for (const [w, h] of windows) {
      const f = fit(w, h);
      expect(DESIGN.width * f.scale).toBeLessThanOrEqual(w + 1e-9);
      expect(DESIGN.height * f.scale).toBeLessThanOrEqual(h + 1e-9);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
    }
  });
});
