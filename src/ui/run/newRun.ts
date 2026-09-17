import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { Scene, SceneContext } from '../../app/router';
import { profileStore } from '../../app/profile';
import { runController } from '../../app/runController';
import type { ClassId, CompanionId } from '../../content/schema';
import { maxSeal, unlocks } from '../../engine/meta/profile';
import { createStreams, formatSeed } from '../../engine/rng';
import { describeResolved, resolveCard } from '../../engine/rules';
import { DESIGN } from '../../app/fit';
import { CardView } from '../cards/CardView';
import { backdrop } from '../kit/backdrop';
import { Button } from '../kit/button';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';

type Step = 'class' | 'origin' | 'companion' | 'seal' | 'boon';

export const SEAL_TEXT: Record<number, string> = {
  1: 'Elites appear more often',
  2: 'Normal enemies +10% HP',
  3: 'Elites +15% HP',
  4: 'Bosses +15% HP',
  5: 'Chapter rests heal less',
  6: 'Start the run at 90% HP',
  7: 'Enemies deal +10% damage',
  8: 'Merchant prices +20%',
  9: 'Start with a Doubt in your deck',
  10: 'Every boss gains its Seal move',
};

export const COMPANION_TEXT: Record<CompanionId, string> = {
  wolf: 'Bite: 5 damage to a random enemy.',
  bear: 'Guard: you gain 5 block.',
  hawk: 'Peck: 2 damage and Mark 1 to a random enemy.',
  serpent: 'Venom: 3 Poison to a random enemy.',
  boar: 'Gore: 8 damage to a random enemy, every other turn.',
};

interface PanelOptions {
  title: string;
  sub?: string;
  blurb: string;
  w?: number;
  h?: number;
  color?: number;
  locked?: string;
  onPick?: () => void;
}

type Panel = Container & { select(on: boolean): void };

/** A choice tile: title, subtitle, blurb; greyed with a reason when locked. */
function panel(o: PanelOptions): Panel {
  const w = o.w ?? 400;
  const h = o.h ?? 300;
  const c = new Container() as Panel;
  const frame = new Graphics();
  c.addChild(frame);
  const paint = (on: boolean) => {
    frame.clear();
    frame.roundRect(-w / 2, -h / 2, w, h, 18).fill({ color: PALETTE.parchment, alpha: on ? 0.12 : 0.05 }).stroke({ color: on ? PALETTE.goldBright : PALETTE.gold, width: on ? 4 : 2, alpha: o.locked ? 0.4 : 1 });
  };
  paint(false);
  c.select = paint;
  const title = makeText(o.title.toUpperCase(), { ...STYLE.display(26), fill: o.color ?? PALETTE.gold, letterSpacing: 2, wordWrap: true, wordWrapWidth: w - 40, align: 'center' });
  title.anchor.set(0.5, 0);
  title.position.set(0, -h / 2 + 24);
  c.addChild(title);
  let y = -h / 2 + 24 + title.height + 8;
  if (o.sub) {
    const sub = makeText(o.sub, { ...STYLE.body(20), fontStyle: 'italic', fill: PALETTE.parchmentDim });
    sub.anchor.set(0.5, 0);
    sub.position.set(0, y);
    c.addChild(sub);
    y += 32;
  }
  const blurb = makeText(o.blurb, { ...STYLE.body(21), wordWrap: true, wordWrapWidth: w - 48, align: 'center' });
  blurb.anchor.set(0.5, 0);
  blurb.position.set(0, y + 6);
  c.addChild(blurb);
  if (o.locked) {
    const lock = makeText(o.locked, { ...STYLE.mono(16), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: w - 48, align: 'center' });
    lock.anchor.set(0.5, 1);
    lock.position.set(0, h / 2 - 18);
    c.addChild(lock);
    c.alpha = 0.55;
  } else if (o.onPick) {
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', o.onPick);
  }
  return c;
}

/** Choose class, origin, companion, seal and boon, then begin. */
export function newRunScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'new-run' });
  const controller = runController();
  const content = controller.content;
  const profile = profileStore().profile;
  const open = unlocks(profile, content);
  const seed = formatSeed((Math.random() * 0xffffffff) >>> 0);

  const choice = { classId: 'paladin' as ClassId, origin: '', companion: 'wolf' as CompanionId, seal: 0, boon: '' };
  let step: Step = 'class';
  const body = new Container();
  const preview = new Container();
  const crumbs = new Container();
  const next = new Button({ label: 'Next', width: 260, onPress: () => advance(1) });
  const back = new Button({ label: 'Back', variant: 'ghost', width: 200, height: 52, onPress: () => advance(-1) });

  const steps = (): Step[] => (choice.classId === 'tracker' ? ['class', 'origin', 'companion', 'seal', 'boon'] : ['class', 'origin', 'seal', 'boon']);
  const defaultOrigin = (id: ClassId) => Object.values(content.origins).find((o) => o.class === id && o.default)?.id ?? '';

  /** The starter deck as the origin leaves it. */
  function showDeck(): void {
    preview.removeChildren().forEach((c) => c.destroy({ children: true }));
    const cls = content.classes[choice.classId]!;
    const deck = [...cls.starter];
    for (const [out, into] of content.origins[choice.origin]?.swaps ?? []) {
      const i = deck.indexOf(out);
      if (i >= 0) deck[i] = into;
    }
    const ids = [...new Set(deck)];
    ids.forEach((cardId, i) => {
      const def = content.cards[cardId]!;
      const resolved = resolveCard(def, false);
      const cost = resolved.cost === 'X' ? ('X' as const) : { value: resolved.cost, base: resolved.cost };
      const cv = new CardView(i, def, { resolved, segments: describeResolved(resolved), cost });
      cv.scale.set(0.5);
      cv.position.set(DESIGN.width / 2 + (i - (ids.length - 1) / 2) * 135, 800);
      const count = deck.filter((c) => c === cardId).length;
      if (count > 1) {
        const badge = makeText(`×${count}`, { ...STYLE.mono(20), fill: PALETTE.goldBright });
        badge.anchor.set(0.5);
        badge.position.set(cv.x + 50, cv.y - 98);
        preview.addChild(badge);
      }
      preview.addChild(cv);
      cv.alpha = 0;
      gsap.to(cv, { alpha: 1, duration: d(0.2), delay: d(0.04 * i) });
    });
  }

  function paintCrumbs(): void {
    crumbs.removeChildren().forEach((c) => c.destroy({ children: true }));
    const list = steps();
    const labels: Record<Step, string> = { class: 'Class', origin: 'Origin', companion: 'Companion', seal: 'Seal', boon: 'Boon' };
    let x = 0;
    const parts: Container[] = [];
    list.forEach((s, i) => {
      const done = list.indexOf(step) > i;
      const t = makeText(labels[s].toUpperCase(), { ...STYLE.display(22), fill: s === step ? PALETTE.goldBright : done ? PALETTE.parchment : PALETTE.parchmentDim, letterSpacing: 3 });
      t.position.set(x, 0);
      parts.push(t);
      x += t.width + 24;
      if (i < list.length - 1) {
        const dot = makeText('·', { ...STYLE.display(22), fill: PALETTE.parchmentDim });
        dot.position.set(x, 0);
        parts.push(dot);
        x += dot.width + 24;
      }
    });
    for (const p of parts) {
      p.x -= x / 2;
      crumbs.addChild(p);
    }
  }

  function show(s: Step): void {
    step = s;
    body.removeChildren().forEach((c) => c.destroy({ children: true }));
    paintCrumbs();
    const list = steps();
    const at = list.indexOf(s);
    next.alpha = 1;
    preview.visible = s === 'class' || s === 'origin';
    const panels: Panel[] = [];
    const selectOnly = (p: Panel) => panels.forEach((q) => q.select(q === p));

    if (s === 'class') {
      (['paladin', 'tracker', 'mage'] as ClassId[]).forEach((id, i) => {
        const cls = content.classes[id]!;
        const p = panel({
          title: cls.name,
          sub: cls.title,
          blurb: `♥ ${cls.hp}${cls.companion ? '  ·  a Companion' : ''}\n\n${cls.blurb}`,
          h: 320,
          color: PALETTE.class[id],
          onPick: () => {
            choice.classId = id;
            choice.origin = defaultOrigin(id);
            choice.companion = content.origins[choice.origin]?.companion ?? 'wolf';
            choice.seal = Math.min(choice.seal, maxSeal(profile, id));
            selectOnly(p);
            paintCrumbs();
            showDeck();
          },
        });
        p.position.set(DESIGN.width / 2 + (i - 1) * 440, 440);
        p.select(id === choice.classId);
        panels.push(p);
        body.addChild(p);
      });
      showDeck();
    }

    if (s === 'origin') {
      const origins = Object.values(content.origins).filter((o) => o.class === choice.classId);
      origins.forEach((o, i) => {
        const unlocked = open.origins.includes(o.id);
        const page = Object.values(content.pages).find((pg) => pg.kind === 'origin' && pg.unlocks.includes(o.id));
        const relic = content.relics[o.relic];
        const p = panel({
          title: o.name,
          sub: relic?.name,
          blurb: `${o.blurb}${relic ? `\n\n${relic.text}` : ''}`,
          w: 440,
          h: 340,
          locked: unlocked ? undefined : `Unlock in the Tome · ${page?.cost ?? '?'} Lore`,
          onPick: () => {
            choice.origin = o.id;
            if (o.companion && open.companions.includes(o.companion)) choice.companion = o.companion;
            selectOnly(p);
            showDeck();
          },
        });
        p.position.set(DESIGN.width / 2 + (i - (origins.length - 1) / 2) * 480, 440);
        p.select(o.id === choice.origin);
        panels.push(p);
        body.addChild(p);
      });
      showDeck();
    }

    if (s === 'companion') {
      const all: CompanionId[] = ['wolf', 'bear', 'hawk', 'serpent', 'boar'];
      all.forEach((id, i) => {
        const unlocked = open.companions.includes(id);
        const page = Object.values(content.pages).find((pg) => pg.kind === 'companion' && pg.unlocks.includes(id));
        const p = panel({
          title: id,
          blurb: `Acts at the end of your turn.\n\n${COMPANION_TEXT[id]}`,
          w: 330,
          h: 300,
          locked: unlocked ? undefined : `Unlock in the Tome · ${page?.cost ?? '?'} Lore`,
          onPick: () => {
            choice.companion = id;
            selectOnly(p);
          },
        });
        p.position.set(DESIGN.width / 2 + (i - 2) * 350, 460);
        p.select(id === choice.companion);
        panels.push(p);
        body.addChild(p);
      });
    }

    if (s === 'seal') {
      const top = maxSeal(profile, choice.classId);
      const intro = makeText(top === 0 ? 'Seals make the run harder and earn more Lore. Win a run with this class to unlock Seal 1.' : `Win at Seal ${top} with this class to unlock Seal ${Math.min(10, top + 1)}.`, { ...STYLE.body(24), fill: PALETTE.parchmentDim, align: 'center', wordWrap: true, wordWrapWidth: 1000 });
      intro.anchor.set(0.5, 0);
      intro.position.set(DESIGN.width / 2, 230);
      body.addChild(intro);
      for (let n = 0; n <= 10; n++) {
        const b = new Button({
          label: String(n),
          width: 64,
          height: 52,
          fontSize: 24,
          variant: n === choice.seal ? 'gold' : 'ghost',
          disabled: n > top,
          onPress: () => {
            choice.seal = n;
            show('seal');
          },
        });
        b.position.set(DESIGN.width / 2 + (n - 5) * 76, 330);
        body.addChild(b);
      }
      for (let n = 1; n <= 10; n++) {
        const on = n <= choice.seal;
        const t = makeText(`Seal ${n}  ·  ${SEAL_TEXT[n]}`, { ...STYLE.body(24), fill: on ? PALETTE.parchment : PALETTE.parchmentDim });
        t.alpha = on ? 1 : n <= top ? 0.7 : 0.35;
        t.position.set(DESIGN.width / 2 - 260, 400 + (n - 1) * 40);
        body.addChild(t);
      }
    }

    if (s === 'boon') {
      const pool = open.boons.filter((id) => !content.boons[id]?.class || content.boons[id]?.class === choice.classId);
      const offered = createStreams(`${seed}:boons`).rewards.shuffle(pool).slice(0, 3);
      if (!offered.includes(choice.boon)) choice.boon = '';
      const intro = makeText('One gift for the road. More Boons are written in the Tome.', { ...STYLE.body(24), fill: PALETTE.parchmentDim });
      intro.anchor.set(0.5, 0);
      intro.position.set(DESIGN.width / 2, 250);
      body.addChild(intro);
      offered.forEach((id, i) => {
        const boon = content.boons[id]!;
        const p = panel({
          title: boon.name,
          blurb: boon.text,
          w: 400,
          h: 200,
          onPick: () => {
            choice.boon = id;
            selectOnly(p);
            next.alpha = 1;
          },
        });
        p.position.set(DESIGN.width / 2 + (i - (offered.length - 1) / 2) * 440, 440);
        p.select(id === choice.boon);
        panels.push(p);
        body.addChild(p);
      });
      const seedLine = makeText(`seed ${seed}`, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
      seedLine.anchor.set(0.5);
      seedLine.position.set(DESIGN.width / 2, 600);
      body.addChild(seedLine);
      next.alpha = choice.boon ? 1 : 0.4;
    }

    next.setLabel(at === list.length - 1 ? 'Begin' : 'Next');
  }

  function advance(dir: 1 | -1): void {
    const list = steps();
    const i = list.indexOf(step) + dir;
    if (i < 0) {
      ctx.router.go('/');
      return;
    }
    if (i >= list.length) {
      if (!choice.boon) return;
      controller.newRun({ classId: choice.classId, origin: choice.origin, companion: choice.classId === 'tracker' ? choice.companion : undefined, seal: choice.seal, boon: choice.boon }, seed);
      ctx.router.go('/run/map');
      return;
    }
    show(list[i]!);
  }

  return {
    view,
    enter() {
      view.addChild(backdrop());
      const title = makeText('A NEW RUN', { ...STYLE.display(48), fill: PALETTE.gold, letterSpacing: 6 });
      title.anchor.set(0.5, 0);
      title.position.set(DESIGN.width / 2, 60);
      view.addChild(title);
      crumbs.position.set(DESIGN.width / 2, 140);
      view.addChild(crumbs, body, preview);
      next.position.set(DESIGN.width - 220, DESIGN.height - 70);
      back.position.set(140, DESIGN.height - 70);
      view.addChild(next, back);
      choice.origin = defaultOrigin('paladin');
      show('class');
    },
    exit() {},
  };
}
