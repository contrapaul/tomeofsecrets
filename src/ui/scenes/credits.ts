import { Container } from 'pixi.js';
import { ART } from '../../app/art';
import { DESIGN } from '../../app/fit';
import type { Scene, SceneContext } from '../../app/router';
import { loadContent } from '../../content';
import { backdrop } from '../kit/backdrop';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';

const ROLE_TITLE: Record<string, string> = { art: 'Art', music: 'Music', writing: 'Writing', design: 'Design', code: 'Code', test: 'Playtesting' };

/** Everyone in credits.json, by role, with what they drew. Generated, never hand-written. */
export function creditsList(content: ReturnType<typeof loadContent>, width = 1100): Container {
  const out = new Container();
  const drew = new Map<string, string[]>();
  for (const [id, e] of Object.entries(ART.enemies)) drew.set(e.artist, [...(drew.get(e.artist) ?? []), content.enemies[id]?.name ?? id]);
  for (const [id, c] of Object.entries(ART.cards)) if (c.artist) drew.set(c.artist, [...(drew.get(c.artist) ?? []), content.cards[id]?.name ?? id]);

  const byRole = new Map<string, typeof content.credits[string][]>();
  for (const c of Object.values(content.credits)) {
    if (c.id === 'placeholder') continue;
    byRole.set(c.role, [...(byRole.get(c.role) ?? []), c]);
  }
  let y = 0;
  for (const [role, people] of byRole) {
    const h = makeText((ROLE_TITLE[role] ?? role).toUpperCase(), { ...STYLE.display(26), fill: PALETTE.parchmentDim, letterSpacing: 4 });
    h.anchor.set(0.5, 0);
    h.position.set(0, y);
    out.addChild(h);
    y += 44;
    for (const p of people) {
      const works = drew.get(p.id);
      const line = makeText(works?.length ? `${p.name}  ·  ${works.join(', ')}` : p.name, { ...STYLE.body(28), wordWrap: true, wordWrapWidth: width, align: 'center' });
      line.anchor.set(0.5, 0);
      line.position.set(0, y);
      out.addChild(line);
      y += line.height + 12;
    }
    y += 30;
  }
  return out;
}

export function creditsScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'credits' });
  return {
    view,
    enter() {
      view.addChild(backdrop());
      const title = makeText('CREDITS', { ...STYLE.display(64), fill: PALETTE.gold, letterSpacing: 8 });
      title.anchor.set(0.5, 0);
      title.position.set(DESIGN.width / 2, 90);
      view.addChild(title);
      const list = creditsList(loadContent());
      list.position.set(DESIGN.width / 2, 220);
      view.addChild(list);
      const back = new Button({ label: 'Back', variant: 'ghost', width: 240, onPress: () => ctx.router.go('/') });
      back.position.set(DESIGN.width / 2, DESIGN.height - 90);
      view.addChild(back);
    },
    exit() {},
  };
}
