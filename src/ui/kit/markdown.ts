import { Container, Graphics } from 'pixi.js';
import type { ContentRegistry } from '../../content';
import type { Block, Chapter, Inline } from '../../engine/guide/parse';
import { resolveCard, describeResolved, fillTokens } from '../../engine/rules';
import { CardView } from '../cards/CardView';
import { FONT } from '../../app/fonts';
import { PALETTE } from './palette';
import { richText, type Run } from './richText';
import { makeText, STYLE } from './text';
import type { Explainer } from './explainer';

const BODY = 24;
const GAP = 18;

/** `[[term]]` runs print gold and carry the id, so the page can explain them. */
function runsOf(inline: Inline[]): { runs: Run[]; terms: { text: string; id: string }[] } {
  const terms: { text: string; id: string }[] = [];
  const runs = inline.map((i) => {
    const style: Run['style'] = {};
    if (i.bold) style.fontWeight = '700';
    if (i.italic) style.fontStyle = 'italic';
    if (i.term) {
      style.fill = PALETTE.gold;
      terms.push({ text: i.text, id: i.term });
    }
    return { text: i.text, style };
  });
  return { runs, terms };
}

/**
 * One chapter, laid out into a column of the given width. Returns the container;
 * the caller measures its height for the scroll surface.
 *
 * Directives render from content, so the status table in the guide and the
 * status in the fight can never disagree.
 */
export function renderChapter(chapter: Chapter, content: ContentRegistry, width: number, explainer?: Explainer): Container {
  const view = new Container({ label: `chapter:${chapter.id}` });
  let y = 0;

  const add = (child: Container, height: number, gap = GAP): void => {
    child.position.set(0, y);
    view.addChild(child);
    y += height + gap;
  };

  const paragraph = (inline: Inline[], size = BODY, indent = 0): void => {
    const { runs, terms } = runsOf(inline);
    const block = richText(runs, { width: width - indent, base: { ...STYLE.body(size) }, align: 'left' });
    block.view.x = indent;
    add(block.view, block.height);
    // The gold words explain themselves, the same panel a card's words use.
    if (explainer && terms.length) {
      for (const t of terms) void t;
      block.view.eventMode = 'static';
      explainer.attach(block.view, () => explainer.forTerm(terms[0]!.id), { header: true });
    }
  };

  const table = (head: string[], rows: string[][]): void => {
    const cols = head.length;
    // A name-and-meaning table wants a narrow first column, not two even halves.
    const widths = cols === 2 ? [width * 0.28, width * 0.72] : Array.from({ length: cols }, () => width / cols);
    const xOf = (i: number) => widths.slice(0, i).reduce((a, b) => a + b, 0);
    const grid = new Container();
    let ty = 0;
    const line = (cells: string[], bold: boolean): void => {
      let tallest = 0;
      cells.forEach((cell, i) => {
        const { runs } = runsOf([{ text: cell, bold }]);
        const r = richText(runs, {
          width: widths[i]! - 16,
          base: { ...STYLE.body(20), fill: bold ? PALETTE.gold : PALETTE.parchment },
          align: 'left',
        });
        r.view.position.set(xOf(i), ty);
        grid.addChild(r.view);
        tallest = Math.max(tallest, r.height);
      });
      ty += tallest + 12;
      const rule = new Graphics();
      rule.rect(0, ty - 6, width, 1).fill({ color: PALETTE.parchment, alpha: bold ? 0.25 : 0.08 });
      grid.addChild(rule);
    };
    line(head, true);
    for (const r of rows) line(r, false);
    add(grid, ty);
  };

  const directive = (name: string, arg?: string): void => {
    const glossary = Object.values(content.glossary);
    if (name === 'statuses' || name === 'keywords' || name === 'resources' || name === 'nodes') {
      const kind = name === 'statuses' ? 'status' : name === 'keywords' ? 'keyword' : name === 'resources' ? 'resource' : 'node';
      const rows = glossary.filter((g) => g.kind === kind).map((g) => [g.name, fillTokens(g.text)]);
      table([kind === 'status' ? 'Status' : kind === 'keyword' ? 'Keyword' : kind === 'resource' ? 'Resource' : 'Room', 'What it does'], rows);
      return;
    }
    if (name === 'glossary') {
      const rows = [...glossary].sort((a, b) => a.name.localeCompare(b.name)).map((g) => [g.name, fillTokens(g.text)]);
      table(['Word', 'What it means'], rows);
      return;
    }
    if (name === 'boons') {
      table(['Boon', 'What it gives'], Object.values(content.boons).map((b) => [b.name, b.text]));
      return;
    }
    if (name === 'starter' && arg) {
      const cls = content.classes[arg];
      if (!cls) return;
      const counts = new Map<string, number>();
      for (const id of cls.starter) counts.set(id, (counts.get(id) ?? 0) + 1);
      table(['Card', 'How many'], [...counts].map(([id, n]) => [content.cards[id]?.name ?? id, `${n}`]));
      return;
    }
    if ((name === 'card' || name === 'relic') && arg) {
      if (name === 'relic') {
        const relic = content.relics[arg];
        if (relic) paragraph([{ text: relic.name, bold: true }, { text: ` — ${relic.text}` }]);
        return;
      }
      const def = content.cards[arg];
      if (!def) return;
      const resolved = resolveCard(def, false);
      const cost = resolved.cost === 'X' ? ('X' as const) : { value: resolved.cost, base: resolved.cost };
      const card = new CardView(0, def, { resolved, segments: describeResolved(resolved), cost });
      card.scale.set(0.85);
      const holder = new Container();
      card.position.set(width / 2, (340 * 0.85) / 2);
      holder.addChild(card);
      add(holder, 340 * 0.85);
    }
  };

  for (const block of chapter.blocks) render(block);

  function render(block: Block): void {
    switch (block.kind) {
      case 'heading': {
        const size = block.level === 1 ? 44 : block.level === 2 ? 30 : 25;
        const { runs } = runsOf(block.text);
        const text = makeText(runs.map((r) => r.text).join(''), {
          fontFamily: FONT.display,
          fontWeight: block.level === 1 ? '900' : '700',
          fontSize: size,
          fill: block.level === 1 ? PALETTE.goldBright : PALETTE.gold,
          wordWrap: true,
          wordWrapWidth: width,
        });
        // A heading wants air above it, never below the one before.
        if (view.children.length) y += block.level === 1 ? 20 : 14;
        add(text, text.height, block.level === 1 ? 14 : 10);
        return;
      }
      case 'para':
        paragraph(block.text);
        return;
      case 'list': {
        for (const item of block.items) {
          const dot = new Graphics();
          dot.circle(10, BODY * 0.55, 3.5).fill({ color: PALETTE.gold, alpha: 0.8 });
          dot.position.set(0, y);
          view.addChild(dot);
          paragraph(item, BODY, 30);
          y -= GAP - 6;
        }
        y += GAP - 6;
        return;
      }
      case 'table':
        table(block.head, block.rows);
        return;
      case 'directive':
        directive(block.name, block.arg);
        return;
    }
  }

  return view;
}
