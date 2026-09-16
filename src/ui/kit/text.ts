import { Text, type TextOptions, type TextStyleOptions } from 'pixi.js';
import { FONT } from '../../app/fonts';
import type { Stage } from '../../app/stage';
import { PALETTE } from './palette';

let stage: Stage | null = null;

/** Called once at boot so every Text made here re-rasterises on resize. */
export function bindTextToStage(s: Stage): void {
  stage = s;
}

export const STYLE = {
  display: (size = 48): TextStyleOptions => ({
    fontFamily: FONT.display,
    fontWeight: '700',
    fontSize: size,
    fill: PALETTE.parchment,
    letterSpacing: size * 0.06,
  }),
  body: (size = 26): TextStyleOptions => ({
    fontFamily: FONT.body,
    fontSize: size,
    fill: PALETTE.parchment,
    lineHeight: size * 1.3,
  }),
  mono: (size = 20): TextStyleOptions => ({
    fontFamily: FONT.mono,
    fontSize: size,
    fill: PALETTE.parchment,
  }),
} as const;

export function makeText(text: string, style: TextStyleOptions, extra: Omit<TextOptions, 'text' | 'style'> = {}): Text {
  const t = new Text({ text, style, ...extra });
  stage?.registerText(t);
  return t;
}
