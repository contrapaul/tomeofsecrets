import { Container, Graphics } from 'pixi.js';
import { loadContent } from '../../content';
import { parseGuide, type Chapter } from '../../engine/guide/parse';
import { DESIGN } from '../../app/fit';
import type { Scene, SceneContext } from '../../app/router';
import { backdrop } from '../kit/backdrop';
import { Button } from '../kit/button';
import { Explainer } from '../kit/explainer';
import { renderChapter } from '../kit/markdown';
import { PALETTE } from '../kit/palette';
import { pageKeys, Scroll } from '../kit/scroll';
import { makeText, STYLE } from '../kit/text';

const COLUMN = 420;
const PAGE_W = 1100;

/** Chapters grouped by section, in the order the front matter asks for. */
export function chaptersOf(guide: Record<string, string>): Chapter[] {
  return Object.entries(guide)
    .map(([id, src]) => parseGuide(src, id))
    .sort((a, b) => (a.section === b.section ? a.order - b.order : a.section.localeCompare(b.section)));
}

/**
 * `#/knowledge` — the Tome of Knowledge. The left column lists the chapters,
 * the right scrolls one. Written for a reader who has never played, so it is
 * reachable from the title, the Tome and mid-fight.
 */
export function knowledgeScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'knowledge' });
  const content = loadContent();
  const explainer = new Explainer(content, ctx.stage);
  const chapters = chaptersOf(content.guide);
  let current = chapters[0];

  const scroll = new Scroll(PAGE_W, 760);
  const menu = new Container();
  let onKey: ((e: KeyboardEvent) => void) | null = null;

  function paintMenu(): void {
    menu.removeChildren().forEach((c) => c.destroy({ children: true }));
    let y = 0;
    let section = '';
    for (const c of chapters) {
      if (c.section !== section) {
        section = c.section;
        const label = makeText(section.toUpperCase(), { ...STYLE.mono(16), fill: PALETTE.parchmentDim, letterSpacing: 2 });
        label.position.set(0, y);
        menu.addChild(label);
        y += 34;
      }
      const on = c.id === current?.id;
      const row = new Container();
      const bg = new Graphics();
      bg.roundRect(-10, -6, COLUMN - 40, 40, 8).fill({ color: PALETTE.parchment, alpha: on ? 0.12 : 0 });
      row.addChild(bg);
      const label = makeText(c.title, { ...STYLE.display(22), fill: on ? PALETTE.goldBright : PALETTE.parchment });
      row.addChild(label);
      row.position.set(14, y);
      row.eventMode = 'static';
      row.cursor = 'pointer';
      row.on('pointertap', () => {
        if (c.id === current?.id) return;
        current = c;
        paintMenu();
        paintPage();
      });
      menu.addChild(row);
      y += 46;
    }
  }

  function paintPage(): void {
    scroll.content.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!current) return;
    scroll.content.addChild(renderChapter(current, content, PAGE_W - 40, explainer));
    scroll.measure();
    scroll.scrollTo(0);
  }

  return {
    view,
    enter(params) {
      // `#/knowledge?chapter=statuses` — the Explainer's "more" links land here.
      current = chapters.find((c) => c.id === params.get('chapter')) ?? chapters[0];
      view.addChild(backdrop());
      const title = makeText('THE TOME OF KNOWLEDGE', { ...STYLE.display(40), fill: PALETTE.gold });
      title.anchor.set(0.5, 0);
      title.position.set(DESIGN.width / 2, 48);
      view.addChild(title);

      if (!chapters.length) {
        const empty = makeText('No chapters yet.', { ...STYLE.body(26), fill: PALETTE.parchmentDim });
        empty.anchor.set(0.5);
        empty.position.set(DESIGN.width / 2, DESIGN.height / 2);
        view.addChild(empty);
      }

      menu.position.set(90, 170);
      view.addChild(menu);
      scroll.position.set(DESIGN.width - PAGE_W - 120, 150);
      view.addChild(scroll);

      const rule = new Graphics();
      rule.rect(COLUMN + 60, 150, 1, 760).fill({ color: PALETTE.parchment, alpha: 0.1 });
      view.addChild(rule);

      const back = new Button({ label: 'Back', variant: 'ghost', width: 200, height: 52, onPress: () => window.history.back() });
      back.position.set(150, DESIGN.height - 110);
      view.addChild(back);

      paintMenu();
      paintPage();
      onKey = pageKeys(scroll);
      window.addEventListener('keydown', onKey);
    },
    update() {
      scroll.update();
    },
    exit() {
      if (onKey) window.removeEventListener('keydown', onKey);
      explainer.destroy({ children: true });
    },
  };
}
