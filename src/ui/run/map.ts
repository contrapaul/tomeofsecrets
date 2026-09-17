import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { Scene, SceneContext } from '../../app/router';
import { MAP_COLS, MAP_FLOORS, findNode, type MapNode, type NodeType } from '../../engine/run/map';
import { abandon, availableNodes, enterNode } from '../../engine/run/run';
import { Button } from '../kit/button';
import { DESIGN } from '../../app/fit';
import { icon, type IconName } from '../kit/icons';
import { d, spatial } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';

const ICON: Record<NodeType, IconName> = { fight: 'sword', elite: 'skull', event: 'question', merchant: 'star', camp: 'shield', treasure: 'star', unknown: 'question', boss: 'skull' };
const COLOR: Record<NodeType, number> = { fight: PALETTE.type.attack, elite: 0xb03040, event: PALETTE.type.power, merchant: PALETTE.gold, camp: PALETTE.type.skill, treasure: PALETTE.goldBright, unknown: PALETTE.type.status, boss: PALETTE.blood };
const LABEL: Record<NodeType, string> = { fight: 'Fight', elite: 'Elite', event: 'Event', merchant: 'Merchant', camp: 'Camp', treasure: 'Treasure', unknown: '?', boss: 'Boss' };
const HINT: Record<NodeType, string> = {
  fight: 'A normal fight. Gold and a card.', elite: 'A hard fight. A relic too.', event: 'Something to read, and a choice.', merchant: 'Cards, relics, vials, card removal.',
  camp: 'Rest to heal, or Smith to upgrade a card.', treasure: 'A relic, free.', unknown: 'Could be anything.', boss: 'The chapter boss.',
};

/** The chapter map. Reachable nodes glow; click one to go. */
export function mapScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['map'], ({ view, run, content, tooltip, next }) => {
    const map = run.map;
    const left = 380;
    const colW = (DESIGN.width - left * 2) / (MAP_COLS - 1);
    const top = 150;
    const rowH = (DESIGN.height - top - 110) / MAP_FLOORS;
    const pos = (n: MapNode) => ({ x: left + n.col * colW, y: DESIGN.height - 110 - (n.floor - 1) * rowH });
    const bossPos = { x: DESIGN.width / 2, y: top - 40 };

    const title = makeText(`CHAPTER ${run.chapter} · THE MOSS HALLS`, { ...STYLE.display(30), fill: PALETTE.gold, letterSpacing: 4 });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN.width / 2, 80);
    view.addChild(title);

    const lines = new Graphics();
    view.addChild(lines);
    const available = availableNodes(run).map((n) => n.id);
    const visited = new Set(run.visited);
    for (const row of map.floors) {
      for (const n of row) {
        if (!n) continue;
        const a = pos(n);
        for (const id of n.next) {
          const b = id === 'boss' ? bossPos : pos(findNode(map, id)!);
          const onPath = visited.has(n.id) && (visited.has(id) || available.includes(id));
          lines.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: onPath ? PALETTE.goldBright : PALETTE.parchmentDim, width: onPath ? 4 : 2, alpha: onPath ? 0.9 : 0.25 });
        }
      }
    }

    const nodes = new Container();
    view.addChild(nodes);
    const draw = (n: MapNode, at: { x: number; y: number }) => {
      const c = new Container();
      const isHere = run.position === n.id;
      const canGo = available.includes(n.id);
      const wasHere = visited.has(n.id);
      const r = n.type === 'boss' ? 40 : 26;
      const g = new Graphics();
      g.circle(0, 0, r).fill({ color: wasHere || isHere ? COLOR[n.type] : 0x1a1724, alpha: wasHere && !isHere ? 0.5 : 1 }).stroke({ color: canGo ? PALETTE.goldBright : isHere ? PALETTE.parchment : COLOR[n.type], width: canGo ? 4 : 2, alpha: canGo || isHere || wasHere ? 1 : 0.7 });
      c.addChild(g);
      const ic = icon(ICON[n.type], wasHere || isHere ? PALETTE.ink : COLOR[n.type], n.type === 'boss' ? 36 : 24);
      c.addChild(ic);
      c.position.set(at.x, at.y);
      c.eventMode = 'static';
      c.on('pointerover', () => {
        const p = tooltip.parent!.toLocal(c.getGlobalPosition());
        tooltip.show(LABEL[n.type], HINT[n.type], p.x, p.y);
        if (canGo) gsap.to(c.scale, { x: 1.15, y: 1.15, duration: d(0.12) });
      });
      c.on('pointerout', () => {
        tooltip.hide();
        gsap.to(c.scale, { x: 1, y: 1, duration: d(0.12) });
      });
      if (canGo) {
        c.cursor = 'pointer';
        if (spatial()) gsap.to(g, { alpha: 0.7, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        c.on('pointertap', () => {
          enterNode(run, content, n.id);
          next();
        });
      }
      nodes.addChild(c);
    };
    for (const row of map.floors) for (const n of row) if (n) draw(n, pos(n));
    draw(map.boss, bossPos);

    // Abandon, with a second click to confirm.
    let armed = false;
    const abandonBtn = new Button({
      label: 'Abandon run',
      variant: 'ghost',
      width: 240,
      height: 48,
      fontSize: 22,
      onPress: () => {
        if (!armed) {
          armed = true;
          abandonBtn.alpha = 1;
          const warn = makeText('Click again to abandon. The run is lost.', { ...STYLE.mono(16), fill: 0xe07b7b });
          warn.anchor.set(0, 0.5);
          warn.position.set(290, DESIGN.height - 40);
          view.addChild(warn);
          setTimeout(() => {
            armed = false;
            warn.destroy();
          }, 4000);
          return;
        }
        abandon(run);
        next();
      },
    });
    abandonBtn.alpha = 0.6;
    abandonBtn.position.set(150, DESIGN.height - 40);
    view.addChild(abandonBtn);

    // The hero marker.
    if (run.position) {
      const here = run.position === 'boss' ? bossPos : pos(findNode(map, run.position)!);
      const m = makeText('▲', { ...STYLE.mono(22), fill: PALETTE.goldBright });
      m.anchor.set(0.5);
      m.position.set(here.x, here.y + 44);
      view.addChild(m);
    } else {
      const hint = makeText('Choose where to begin', { ...STYLE.body(24), fill: PALETTE.parchmentDim });
      hint.anchor.set(0.5);
      hint.position.set(DESIGN.width / 2, DESIGN.height - 40);
      view.addChild(hint);
    }
  });
}
