import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import gsap from 'gsap';
import type { Scene, SceneContext } from '../../app/router';
import { MAP_COLS, MAP_FLOORS, findNode, type MapNode, type NodeType } from '../../engine/run/map';
import { abandon, availableNodes, enterNode } from '../../engine/run/run';
import { audio } from '../../app/audio';
import { isPhone } from '../../app/device';
import { markTutorial, tutorialPending } from '../../app/tutorial';
import { Button } from '../kit/button';
import { Coach } from '../kit/coach';
import { DESIGN } from '../../app/fit';
import { icon, type IconName } from '../kit/icons';
import { d, spatial } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';

/** A phone draws the board at twice the size and drags it around. */
const PHONE_ZOOM = 2;
/** Node tap radius in board pixels: a finger is wider than the dot it aims at. */
const TAP_R = 34;
/** Past this much travel the gesture was a pan, not a tap on a node. */
const PAN_SLOP = 8;

const ICON: Record<NodeType, IconName> = { fight: 'sword', elite: 'skull', event: 'question', merchant: 'star', camp: 'shield', treasure: 'star', unknown: 'question', boss: 'skull' };
const COLOR: Record<NodeType, number> = { fight: PALETTE.type.attack, elite: 0xb03040, event: PALETTE.type.power, merchant: PALETTE.gold, camp: PALETTE.type.skill, treasure: PALETTE.goldBright, unknown: PALETTE.type.status, boss: PALETTE.blood };

/** The chapter map. Reachable nodes glow; click one to go. */
export function mapScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['map'], ({ view, run, content, explainer, next }) => {
    const map = run.map;
    const left = 380;
    const colW = (DESIGN.width - left * 2) / (MAP_COLS - 1);
    const top = 200;
    const rowH = (DESIGN.height - top - 110) / MAP_FLOORS;
    const pos = (n: MapNode) => ({ x: left + n.col * colW, y: DESIGN.height - 110 - (n.floor - 1) * rowH });
    const bossPos = { x: DESIGN.width / 2, y: top - 40 };

    // On a phone the whole map at once is a field of 19px dots, so the board
    // is drawn at twice the size and dragged around. On a desktop it is the
    // same container at 1:1, parked at the origin.
    const board = new Container({ label: 'board' });
    board.scale.set(isPhone() ? PHONE_ZOOM : 1);
    view.addChild(board);
    // Set by dragBoard once the nodes are drawn; on a desktop the board never moves.
    let panned = (): boolean => false;
    let onBoard = (p: { x: number; y: number }): { x: number; y: number } => p;

    const title = makeText(`CHAPTER ${run.chapter} · THE MOSS HALLS`, { ...STYLE.display(30), fill: PALETTE.gold, letterSpacing: 4 });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN.width / 2, 76);
    view.addChild(title);

    const lines = new Graphics();
    board.addChild(lines);
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
    board.addChild(nodes);
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
      // A finger is wider than the dot it is aiming at.
      if (isPhone()) c.hitArea = { contains: (x, y) => x * x + y * y <= TAP_R * TAP_R };
      // Hover explains the node; a touch goes straight to it, the icon is the explanation.
      c.on('pointerover', (e) => {
        if (e.pointerType !== 'touch') explainer.hover(e, c, explainer.forNode(n.type), { side: 'below' });
        if (canGo) gsap.to(c.scale, { x: 1.15, y: 1.15, duration: d(0.12) });
      });
      c.on('pointerout', () => {
        explainer.leave();
        gsap.to(c.scale, { x: 1, y: 1, duration: d(0.12) });
      });
      if (canGo) {
        c.cursor = 'pointer';
        if (spatial()) gsap.to(g, { alpha: 0.7, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        c.on('pointertap', () => {
          if (panned()) return;
          audio().play('map-move');
          enterNode(run, content, n.id);
          next();
        });
      }
      nodes.addChild(c);
    };
    for (const row of map.floors) for (const n of row) if (n) draw(n, pos(n));
    draw(map.boss, bossPos);

    if (isPhone()) {
      const here = run.position ? (run.position === 'boss' ? bossPos : pos(findNode(map, run.position)!)) : { x: DESIGN.width / 2, y: DESIGN.height - 200 };
      ({ panned, onBoard } = dragBoard(board, here));
    }

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

    // First time on a map: what the icons mean, and where to click.
    if (tutorialPending('map')) {
      const coach = new Coach(ctx.stage, [{
        title: 'The map',
        text: `A run climbs this map. ${isPhone() ? 'Tap' : 'Click'} a glowing node to travel there; the paths decide what you can reach next. Swords are fights. Question marks are events. Stars are merchants and treasure. Shields are camps, where you heal or upgrade a card. Skulls are elites, harder fights with a relic at the end, and the skull at the top is the chapter boss. ${isPhone() ? 'Drag the map to look further up it.' : 'Hover any node to see what it is.'}`,
        point: () => available.map((id) => {
          const p = pos(findNode(map, id)!);
          return onBoard({ x: p.x, y: p.y - 30 });
        }),
      }], { x: DESIGN.width / 2 - 350, y: 300 }, () => markTutorial('map'));
      view.addChild(coach);
      coach.start();
    }

    // The hero marker.
    if (run.position) {
      const here = run.position === 'boss' ? bossPos : pos(findNode(map, run.position)!);
      const m = makeText('▲', { ...STYLE.mono(22), fill: PALETTE.goldBright });
      m.anchor.set(0.5);
      m.position.set(here.x, here.y + 44);
      board.addChild(m);
    } else {
      const hint = makeText('Choose where to begin', { ...STYLE.body(24), fill: PALETTE.parchmentDim });
      hint.anchor.set(0.5);
      hint.position.set(DESIGN.width / 2, DESIGN.height - 40);
      view.addChild(hint);
    }
  });
}

/**
 * Drag a zoomed board around under the viewport, clamped to its own content so
 * the map can never be dragged off screen. Returns the two things the scene
 * needs back: whether the gesture so far was a pan (a node tap must not fire
 * at the end of one), and where a board point has ended up on screen.
 */
function dragBoard(board: Container, focus: { x: number; y: number }): { panned: () => boolean; onBoard: (p: { x: number; y: number }) => { x: number; y: number } } {
  const zoom = board.scale.x;
  const b = board.getLocalBounds();
  const span = (viewport: number, start: number, size: number): [number, number] => {
    const lo = viewport - (start + size) * zoom;
    const hi = -start * zoom;
    // Content narrower than the viewport sits in the middle of it instead.
    return lo > hi ? [(lo + hi) / 2, (lo + hi) / 2] : [lo, hi];
  };
  const [minX, maxX] = span(DESIGN.width, b.x, b.width);
  const [minY, maxY] = span(DESIGN.height, b.y, b.height);
  const clamp = (): void => {
    board.x = Math.min(maxX, Math.max(minX, board.x));
    board.y = Math.min(maxY, Math.max(minY, board.y));
  };

  // Open looking at wherever the hero is standing.
  board.position.set(DESIGN.width / 2 - focus.x * zoom, DESIGN.height / 2 - focus.y * zoom);
  clamp();

  let dragging = false;
  let moved = 0;
  let last = { x: 0, y: 0 };
  board.eventMode = 'static';
  // The gaps between the nodes drag too, and a drag that starts on a node
  // bubbles up to here.
  board.hitArea = { contains: () => true };
  board.on('pointerdown', (e: FederatedPointerEvent) => {
    dragging = true;
    moved = 0;
    last = { x: e.global.x, y: e.global.y };
  });
  board.on('globalpointermove', (e: FederatedPointerEvent) => {
    if (!dragging) return;
    const dx = e.global.x - last.x;
    const dy = e.global.y - last.y;
    last = { x: e.global.x, y: e.global.y };
    moved += Math.abs(dx) + Math.abs(dy);
    // The pointer moves in window pixels; the board lives in design pixels.
    const scale = board.parent?.worldTransform.a || 1;
    board.x += dx / scale;
    board.y += dy / scale;
    clamp();
  });
  for (const end of ['pointerup', 'pointerupoutside'] as const) board.on(end, () => { dragging = false; });

  return {
    panned: () => moved > PAN_SLOP,
    onBoard: (p) => ({ x: board.x + p.x * zoom, y: board.y + p.y * zoom }),
  };
}
