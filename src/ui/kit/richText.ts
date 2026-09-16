import { CanvasTextMetrics, Container, TextStyle, type TextStyleOptions } from 'pixi.js';
import { makeText } from './text';

export interface Run {
  text: string;
  /** Style overrides for this run (colour, weight). */
  style?: Partial<TextStyleOptions>;
}

export interface RichTextOptions {
  width: number;
  base: TextStyleOptions;
  align?: 'left' | 'center';
  lineHeight?: number;
}

/**
 * Lay out styled runs into wrapped, centred lines. Adjacent words that share
 * a style become one Text, so a typical card line is three objects, not
 * twenty. Returns the container and its measured height.
 */
export function richText(runs: Run[], opts: RichTextOptions): { view: Container; height: number; lines: number } {
  const view = new Container({ label: 'richText' });
  const size = opts.base.fontSize as number;
  const lineHeight = opts.lineHeight ?? Math.round(size * 1.22);
  const spaceWidth = CanvasTextMetrics.measureText(' ', new TextStyle(opts.base)).width;

  // Tokenise into words that remember their run's style.
  interface Token { text: string; style: TextStyleOptions; width: number; leadingSpace: boolean }
  const tokens: Token[] = [];
  for (const run of runs) {
    const style = { ...opts.base, ...(run.style ?? {}) };
    const ts = new TextStyle(style);
    const parts = run.text.split(/( +)/);
    let pendingSpace = false;
    for (const part of parts) {
      if (part === '') continue;
      if (/^ +$/.test(part)) {
        pendingSpace = true;
        continue;
      }
      // A run boundary inside a word ("+" then "4") must not insert a space.
      tokens.push({ text: part, style, width: CanvasTextMetrics.measureText(part, ts).width, leadingSpace: pendingSpace });
      pendingSpace = false;
    }
    if (pendingSpace) tokens.push({ text: '', style, width: 0, leadingSpace: true });
  }

  // Greedy wrap.
  const lines: Token[][] = [[]];
  let lineWidth = 0;
  for (const tok of tokens) {
    const gap = lines[lines.length - 1]!.length && tok.leadingSpace ? spaceWidth : 0;
    if (lineWidth + gap + tok.width > opts.width && lines[lines.length - 1]!.length) {
      lines.push([]);
      lineWidth = 0;
      tok.leadingSpace = false;
    }
    lines[lines.length - 1]!.push(tok);
    lineWidth += (lines[lines.length - 1]!.length > 1 && tok.leadingSpace ? spaceWidth : 0) + tok.width;
  }

  // Merge same-style neighbours and place.
  lines.forEach((line, li) => {
    const merged: { text: string; style: TextStyleOptions }[] = [];
    for (const tok of line) {
      const last = merged[merged.length - 1];
      const glue = tok.leadingSpace && merged.length ? ' ' : '';
      if (last && last.style === tok.style) last.text += glue + tok.text;
      else if (last && glue) {
        last.text += ' ';
        merged.push({ text: tok.text, style: tok.style });
      } else merged.push({ text: tok.text, style: tok.style });
    }
    const texts = merged.filter((m) => m.text.length).map((m) => makeText(m.text, m.style));
    const total = texts.reduce((w, t) => w + t.width, 0);
    let x = opts.align === 'left' ? 0 : (opts.width - total) / 2;
    for (const t of texts) {
      t.position.set(Math.round(x), li * lineHeight);
      view.addChild(t);
      x += t.width;
    }
  });

  return { view, height: lines.length * lineHeight, lines: lines.length };
}
