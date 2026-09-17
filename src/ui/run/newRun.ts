import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { Scene, SceneContext } from '../../app/router';
import { runController } from '../../app/runController';
import type { ClassId } from '../../content/schema';
import { describeResolved, resolveCard } from '../../engine/rules';
import { DESIGN } from '../../app/fit';
import { CardView } from '../cards/CardView';
import { backdrop } from '../kit/backdrop';
import { Button } from '../kit/button';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';

/** Choose a class, see its starter, start. Origins, Seals and Boons arrive in Phase 6. */
export function newRunScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'new-run' });
  const controller = runController();
  const content = controller.content;
  let chosen: ClassId | null = null;
  const preview = new Container();
  const panels = new Map<ClassId, Container>();

  function pickClass(id: ClassId): void {
    chosen = id;
    for (const [cid, p] of panels) {
      const frame = p.getChildByLabel('frame') as Graphics;
      frame.clear();
      frame.roundRect(-220, -180, 440, 360, 18).fill({ color: PALETTE.parchment, alpha: cid === id ? 0.12 : 0.05 }).stroke({ color: cid === id ? PALETTE.goldBright : PALETTE.gold, width: cid === id ? 4 : 2 });
    }
    preview.removeChildren().forEach((c) => c.destroy({ children: true }));
    const cls = content.classes[id]!;
    const ids = [...new Set(cls.starter)];
    ids.forEach((cardId, i) => {
      const def = content.cards[cardId]!;
      const resolved = resolveCard(def, false);
      const cost = resolved.cost === 'X' ? ('X' as const) : { value: resolved.cost, base: resolved.cost };
      const cv = new CardView(i, def, { resolved, segments: describeResolved(resolved), cost });
      cv.scale.set(0.55);
      cv.position.set(DESIGN.width / 2 + (i - (ids.length - 1) / 2) * 150, 860);
      const count = cls.starter.filter((c) => c === cardId).length;
      if (count > 1) {
        const badge = makeText(`×${count}`, { ...STYLE.mono(20), fill: PALETTE.goldBright });
        badge.anchor.set(0.5);
        badge.position.set(cv.x + 55, cv.y - 110);
        preview.addChild(badge);
      }
      preview.addChild(cv);
      cv.alpha = 0;
      gsap.to(cv, { alpha: 1, duration: d(0.25), delay: d(0.05 * i) });
    });
    start.alpha = 1;
  }

  const start = new Button({
    label: 'Begin',
    onPress: () => {
      if (!chosen) return;
      controller.newRun(chosen);
      ctx.router.go('/run/map');
    },
  });

  return {
    view,
    enter() {
      view.addChild(backdrop());
      const title = makeText('CHOOSE YOUR SEEKER', { ...STYLE.display(48), fill: PALETTE.gold, letterSpacing: 6 });
      title.anchor.set(0.5, 0);
      title.position.set(DESIGN.width / 2, 60);
      view.addChild(title);

      (['paladin', 'tracker', 'mage'] as ClassId[]).forEach((id, i) => {
        const cls = content.classes[id]!;
        const p = new Container();
        const frame = new Graphics();
        frame.label = 'frame';
        frame.roundRect(-220, -180, 440, 360, 18).fill({ color: PALETTE.parchment, alpha: 0.05 }).stroke({ color: PALETTE.gold, width: 2 });
        p.addChild(frame);
        const ring = new Graphics();
        ring.circle(0, -90, 56).fill(PALETTE.inkLight).stroke({ color: PALETTE.class[id], width: 5 });
        p.addChild(ring);
        const initial = makeText(cls.name[0]!, { ...STYLE.display(56), fill: PALETTE.class[id] });
        initial.anchor.set(0.5);
        initial.position.set(0, -90);
        p.addChild(initial);
        const name = makeText(cls.name.toUpperCase(), { ...STYLE.display(30), fill: PALETTE.class[id], letterSpacing: 3 });
        name.anchor.set(0.5);
        name.position.set(0, -10);
        p.addChild(name);
        const sub = makeText(cls.title, { ...STYLE.body(22), fontStyle: 'italic', fill: PALETTE.parchmentDim });
        sub.anchor.set(0.5);
        sub.position.set(0, 24);
        p.addChild(sub);
        const hp = makeText(`♥ ${cls.hp}${cls.companion ? `  ·  ${cls.companion} companion` : ''}`, { ...STYLE.mono(18), fill: PALETTE.parchmentDim });
        hp.anchor.set(0.5);
        hp.position.set(0, 56);
        p.addChild(hp);
        const blurb = makeText(cls.blurb, { ...STYLE.body(20), wordWrap: true, wordWrapWidth: 380, align: 'center' });
        blurb.anchor.set(0.5, 0);
        blurb.position.set(0, 84);
        p.addChild(blurb);
        p.position.set(DESIGN.width / 2 + (i - 1) * 480, 380);
        p.eventMode = 'static';
        p.cursor = 'pointer';
        p.on('pointertap', () => pickClass(id));
        panels.set(id, p);
        view.addChild(p);
      });

      view.addChild(preview);
      start.position.set(DESIGN.width / 2, 640);
      start.alpha = 0.4;
      view.addChild(start);
      const back = new Button({ label: 'Back', variant: 'ghost', width: 200, height: 52, onPress: () => ctx.router.go('/') });
      back.position.set(140, DESIGN.height - 60);
      view.addChild(back);
      pickClass('paladin');
    },
    exit() {},
  };
}
