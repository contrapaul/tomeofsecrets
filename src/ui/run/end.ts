import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { Scene, SceneContext } from '../../app/router';
import { runController } from '../../app/runController';
import { DESIGN } from '../../app/fit';
import { Button } from '../kit/button';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';
import { heading } from './widgets';

/** Won or lost: the summary, the Lore earned, the pages written, and the way back. */
export function runEndScene(ctx: SceneContext): Scene {
  return runScene(
    ctx,
    ['won', 'lost'],
    ({ view, run, content }) => {
      const controller = runController();
      const ledger = controller.settle();
      const won = run.phase === 'won';
      view.addChild(heading(won ? 'Victory' : run.abandoned ? 'Abandoned' : 'Defeat', 110, won ? 'The Moss Halls are behind you.' : run.stats.deathBy ? `Slain by ${content.enemies[run.stats.deathBy.enemy]?.name ?? run.stats.deathBy.enemy}.` : 'The run ends here.'));

      // Left: the run in numbers.
      const lines = [
        `Floor ${run.stats.floorsClimbed} of chapter ${run.chapter}${run.seal ? `  ·  Seal ${run.seal}` : ''}`,
        `${run.stats.fights} fights · ${run.stats.elites} elites · ${run.stats.bosses} bosses`,
        `${run.hero.deck.length} cards · ${run.hero.relics.length} relics · ${run.hero.gold} gold`,
      ];
      const kills = Object.entries(run.stats.kills).sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (kills.length) lines.push(`Slain: ${kills.map(([id, n]) => `${content.enemies[id]?.name ?? id} ×${n}`).join(', ')}`);
      lines.push(`seed ${run.seed}`);
      const box = new Container();
      let y = 0;
      lines.forEach((l, i) => {
        const t = makeText(l, { ...STYLE.body(26), fill: i === lines.length - 1 ? PALETTE.parchmentDim : PALETTE.parchment, wordWrap: true, wordWrapWidth: 760 });
        t.position.set(0, y);
        box.addChild(t);
        y += t.height + 14;
      });
      box.position.set(140, 300);
      view.addChild(box);

      // Right: the Lore ledger, counting up line by line.
      const panel = new Container();
      const bg = new Graphics();
      panel.addChild(bg);
      const title = makeText('LORE EARNED', { ...STYLE.display(26), fill: PALETTE.gold, letterSpacing: 4 });
      title.position.set(28, 22);
      panel.addChild(title);
      let ly = 74;
      const ledgerLines = ledger?.lines ?? [];
      ledgerLines.forEach((line, i) => {
        const label = makeText(line.label, { ...STYLE.body(24) });
        label.position.set(28, ly);
        const amount = makeText(`+${line.amount}`, { ...STYLE.mono(24), fill: PALETTE.goldBright });
        amount.anchor.set(1, 0);
        amount.position.set(672, ly);
        panel.addChild(label, amount);
        label.alpha = amount.alpha = 0;
        gsap.to([label, amount], { alpha: 1, duration: d(0.25), delay: d(0.35 + i * 0.22) });
        ly += 38;
      });
      if (!ledgerLines.length) {
        const none = makeText('Nothing this time. Climb a floor and it counts.', { ...STYLE.body(22), fill: PALETTE.parchmentDim });
        none.position.set(28, ly);
        panel.addChild(none);
        ly += 38;
      }
      const rule = new Graphics();
      rule.rect(28, ly + 6, 644, 2).fill({ color: PALETTE.gold, alpha: 0.5 });
      panel.addChild(rule);
      const total = makeText(`${ledger?.total ?? 0} Lore`, { ...STYLE.display(30), fill: PALETTE.goldBright });
      total.anchor.set(1, 0);
      total.position.set(672, ly + 20);
      panel.addChild(total);
      total.alpha = 0;
      gsap.to(total, { alpha: 1, duration: d(0.3), delay: d(0.5 + ledgerLines.length * 0.22) });
      const balance = makeText(`The Tome holds ${controller.lore()} Lore.`, { ...STYLE.body(20), fill: PALETTE.parchmentDim });
      balance.position.set(28, ly + 28);
      panel.addChild(balance);
      if (ledger?.sealUnlocked) {
        const seal = makeText(`Seal ${ledger.sealUnlocked} unlocked for the ${content.classes[run.hero.classId]?.name ?? run.hero.classId}.`, { ...STYLE.body(22), fill: PALETTE.goldBright });
        seal.position.set(28, ly + 62);
        panel.addChild(seal);
      }
      bg.roundRect(0, 0, 700, ly + (ledger?.sealUnlocked ? 110 : 80), 16).fill({ color: PALETTE.ink, alpha: 0.7 }).stroke({ color: PALETTE.gold, width: 2 });
      panel.position.set(DESIGN.width - 140 - 700, 290);
      view.addChild(panel);

      // New Bestiary pages, flipping open one by one.
      const pages = ledger?.newPages ?? [];
      if (pages.length) {
        const h = makeText('NEW PAGES IN THE TOME', { ...STYLE.display(22), fill: PALETTE.parchmentDim, letterSpacing: 4 });
        h.position.set(140, 560);
        view.addChild(h);
        pages.forEach((id, i) => {
          const e = content.enemies[id];
          const tile = new Container();
          const g = new Graphics();
          g.roundRect(0, 0, 220, 64, 10).fill({ color: PALETTE.parchment, alpha: 0.08 }).stroke({ color: PALETTE.gold, width: 2 });
          tile.addChild(g);
          const name = makeText(e?.name ?? id, { ...STYLE.display(18), fill: PALETTE.parchment, wordWrap: true, wordWrapWidth: 190, align: 'center' });
          name.anchor.set(0.5);
          name.position.set(110, 32);
          tile.addChild(name);
          tile.position.set(140 + (i % 3) * 236, 600 + Math.floor(i / 3) * 80);
          tile.alpha = 0;
          tile.scale.set(0.8);
          view.addChild(tile);
          gsap.to(tile, { alpha: 1, duration: d(0.3), delay: d(0.8 + i * 0.15) });
          gsap.to(tile.scale, { x: 1, y: 1, duration: d(0.35), delay: d(0.8 + i * 0.15), ease: 'back.out(2)' });
        });
      }

      const again = new Button({ label: 'New Run', onPress: () => { controller.clear(); ctx.router.go('/run/new'); } });
      again.position.set(DESIGN.width / 2 - 200, 900);
      const tome = new Button({ label: 'The Tome', variant: 'ghost', onPress: () => { controller.clear(); ctx.router.go('/tome'); } });
      tome.position.set(DESIGN.width / 2 + 200, 900);
      const home = new Button({ label: 'Title', variant: 'ghost', width: 200, height: 52, onPress: () => { controller.clear(); ctx.router.go('/'); } });
      home.position.set(DESIGN.width / 2, 990);
      view.addChild(again, tome, home);
    },
    { bar: false },
  );
}
