/** The design space. Every scene lays out in these pixels and nothing else. */
export const DESIGN = { width: 1920, height: 1080 } as const;

export interface Fit {
  /** Uniform scale that fits the design space inside the window. */
  scale: number;
  /** Top-left of the design space in window pixels; the letterbox offset. */
  x: number;
  y: number;
}

/** Pure: how a window of `w`×`h` holds the 1920×1080 stage. */
export function fit(w: number, h: number): Fit {
  const scale = Math.min(w / DESIGN.width, h / DESIGN.height);
  return {
    scale,
    x: Math.round((w - DESIGN.width * scale) / 2),
    y: Math.round((h - DESIGN.height * scale) / 2),
  };
}
