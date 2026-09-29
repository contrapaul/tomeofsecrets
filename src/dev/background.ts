import { Container, Graphics } from 'pixi.js';
import { loadContent } from '../content';
import { ART, loadBackground, loadCardArtFor, loadEnemyArtFor } from '../app/art';
import { DESIGN } from '../app/fit';
import type { Scene, SceneContext } from '../app/router';
import { describeResolved, resolveCard } from '../engine/rules';
import { CardView } from '../ui/cards/CardView';
import { EnemyView } from '../ui/combat/EnemyView';
import { Explainer } from '../ui/kit/explainer';
import { PALETTE } from '../ui/kit/palette';
import { copyLayers, DEFAULT_LAYERS, ParallaxBackdrop, type LayerName, type LayerSettings } from '../ui/kit/parallax';
import { makeText, STYLE } from '../ui/kit/text';

const LAYERS: LayerName[] = ['back', 'far', 'mid', 'near', 'overlay'];
const ENEMY_BASE_Y = 640;
const HAND_Y = 945;

/** Named starting points, so there is something to react to rather than a blank slider. */
const PRESETS: Record<string, { layers: LayerSettings; overlayOver: boolean }> = {
  Tuned: { layers: DEFAULT_LAYERS, overlayOver: true },
  Still: {
    layers: { ...copyLayers(DEFAULT_LAYERS), back: { drift: 0, scale: 1, visible: true }, far: { drift: 0, scale: 1, visible: true }, mid: { drift: 0, scale: 1, visible: true }, overlay: { drift: 0, scale: 1, visible: true } },
    overlayOver: true,
  },
  Strong: {
    layers: { back: { drift: 10, scale: 1.04, visible: true }, far: { drift: 34, scale: 1.08, visible: true }, mid: { drift: 70, scale: 1.12, visible: true }, near: { drift: 0, scale: 1, visible: true }, overlay: { drift: 18, scale: 1.05, visible: true } },
    overlayOver: true,
  },
  'Overlay behind': { layers: DEFAULT_LAYERS, overlayOver: false },
  'No overlay': {
    layers: { ...copyLayers(DEFAULT_LAYERS), overlay: { drift: 8, scale: 1.03, visible: false } },
    overlayOver: true,
  },
};

/**
 * `#/dev/background?bg=moss-halls` — the fight, without the top bar, with every
 * background layer on a slider. For judging the art against real enemies and a
 * real hand rather than against a screenshot.
 */
export function devBackgroundScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'dev-background' });
  const content = loadContent({ fixtures: true });
  const explainer = new Explainer(content, ctx.stage);
  const fx = new Container();
  const art = new Container({ label: 'art' });
  const mid = new Container({ label: 'mid' });
  const over = new Container({ label: 'over' });
  let backdrop: ParallaxBackdrop | null = null;
  let panel: HTMLDivElement | null = null;
  let settings = copyLayers(DEFAULT_LAYERS);
  let overlayOver = true;
  let key = 'moss-halls';

  const enemyIds = ['ink-slime', 'bramble-sprite', 'librarians-shade'];
  const cardIds = ['hammer-blow', 'raise-shield', 'judgment', 'crusader-strike', 'consecration'];

  function placeOverlay(): void {
    const o = backdrop?.overlay;
    if (!o) return;
    o.removeFromParent();
    (overlayOver ? over : art).addChild(o);
  }

  async function build(): Promise<void> {
    backdrop?.destroy({ children: true });
    art.removeChildren();
    over.removeChildren();
    const tex = await loadBackground(key);
    if (!tex) return;
    backdrop = new ParallaxBackdrop(tex, ctx.stage, settings);
    art.addChild(backdrop);
    placeOverlay();
  }

  return {
    view,
    async enter() {
      const dim = new Graphics();
      dim.rect(0, 0, DESIGN.width, DESIGN.height).fill(PALETTE.ink);
      view.addChild(dim, art, mid, over, fx);
      await build();

      // Real enemies on the real ground line.
      const enemyArt = await loadEnemyArtFor(enemyIds);
      enemyIds.forEach((id, i) => {
        const def = content.enemies[id];
        if (!def) return;
        const inst = { id: `e${i}`, enemyId: id, name: def.name, hp: 30, maxHp: 30, block: i === 1 ? 8 : 0, statuses: {}, intent: { move: 'x', kind: 'attack' as const, hidden: false, damage: 7, hits: 1 }, history: [], usedOnce: [], flags: {}, phase: -1, alive: true, memory: {} };
        const v = new EnemyView(inst, def, enemyArt.get(id) ?? null, explainer, fx);
        v.position.set(700 + i * 320, ENEMY_BASE_Y);
        mid.addChild(v);
      });

      // A real hand, to judge the art against what sits on top of it.
      const cardArt = await loadCardArtFor(cardIds);
      cardIds.forEach((id, i) => {
        const def = content.cards[id];
        if (!def) return;
        const resolved = resolveCard(def, false);
        const cost = resolved.cost === 'X' ? ('X' as const) : { value: resolved.cost, base: resolved.cost };
        const cv = new CardView(i, def, { resolved, segments: describeResolved(resolved), cost, art: cardArt.get(id) ?? null });
        cv.scale.set(0.8);
        cv.position.set(DESIGN.width / 2 + (i - 2) * 200, HAND_Y);
        cv.rotation = (i - 2) * 0.04;
        over.addChild(cv);
      });

      const hint = makeText('move the pointer to see the drift · the panel tunes it live', { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
      hint.anchor.set(0.5, 0);
      hint.position.set(DESIGN.width / 2 - 180, 24);
      over.addChild(hint);

      panel = buildPanel();
      document.body.appendChild(panel);
    },
    exit() {
      panel?.remove();
      explainer.destroy({ children: true });
    },
  };

  function buildPanel(): HTMLDivElement {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;top:12px;right:12px;width:300px;max-height:94vh;overflow:auto;z-index:50;padding:14px;border-radius:12px;background:rgba(11,10,15,0.92);border:1px solid #3a3550;color:#efe4c8;font:13px system-ui,sans-serif';
    const h = document.createElement('div');
    h.textContent = 'Background layers';
    h.style.cssText = 'font-size:15px;font-weight:700;color:#d4a83b;margin-bottom:10px';
    root.appendChild(h);

    const keys = Object.keys(ART.backgrounds);
    row(root, 'Art set', select(keys, key, (v) => { key = v; void build(); }));

    const presetBar = document.createElement('div');
    presetBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px';
    for (const name of Object.keys(PRESETS)) {
      const b = document.createElement('button');
      b.textContent = name;
      b.style.cssText = 'flex:1 0 auto;padding:5px 8px;font:inherit;color:#0b0a0f;background:#d4a83b;border:0;border-radius:6px;cursor:pointer';
      b.onclick = () => {
        const p = PRESETS[name]!;
        settings = copyLayers(p.layers);
        overlayOver = p.overlayOver;
        backdrop?.set(settings);
        placeOverlay();
        root.remove();
        panel = buildPanel();
        document.body.appendChild(panel);
      };
      presetBar.appendChild(b);
    }
    root.appendChild(presetBar);

    for (const name of LAYERS) {
      const s = settings[name];
      const block = document.createElement('div');
      block.style.cssText = 'margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #2a2535';
      const title = document.createElement('label');
      title.style.cssText = 'display:flex;align-items:center;gap:8px;font-weight:600;color:#d4a83b;text-transform:capitalize';
      const on = document.createElement('input');
      on.type = 'checkbox';
      on.checked = s.visible;
      on.onchange = () => { s.visible = on.checked; backdrop?.set(settings); };
      title.append(on, document.createTextNode(name));
      block.appendChild(title);
      block.appendChild(slider('drift', s.drift, 0, 120, 1, (v) => { s.drift = v; backdrop?.set(settings); }));
      block.appendChild(slider('scale', s.scale, 1, 1.2, 0.005, (v) => { s.scale = v; backdrop?.set(settings); }));
      root.appendChild(block);
    }

    const depth = document.createElement('label');
    depth.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px';
    const dbox = document.createElement('input');
    dbox.type = 'checkbox';
    dbox.checked = overlayOver;
    dbox.onchange = () => { overlayOver = dbox.checked; placeOverlay(); };
    depth.append(dbox, document.createTextNode('overlay in front of enemies'));
    root.appendChild(depth);

    const out = document.createElement('button');
    out.textContent = 'Copy these numbers';
    out.style.cssText = 'width:100%;padding:8px;font:inherit;color:#efe4c8;background:transparent;border:1px solid #d4a83b;border-radius:6px;cursor:pointer';
    out.onclick = () => {
      const text = JSON.stringify({ background: key, overlayInFront: overlayOver, layers: settings }, null, 2);
      void navigator.clipboard?.writeText(text);
      out.textContent = 'Copied — paste it to Claude';
      setTimeout(() => { out.textContent = 'Copy these numbers'; }, 1800);
    };
    root.appendChild(out);
    return root;
  }
}

function row(parent: HTMLElement, label: string, control: HTMLElement): void {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px';
  const t = document.createElement('span');
  t.textContent = label;
  wrap.append(t, control);
  parent.appendChild(wrap);
}

function select(options: string[], value: string, onChange: (v: string) => void): HTMLSelectElement {
  const s = document.createElement('select');
  s.style.cssText = 'flex:1;padding:4px;font:inherit;background:#14121c;color:#efe4c8;border:1px solid #3a3550;border-radius:5px';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    if (o === value) opt.selected = true;
    s.appendChild(opt);
  }
  s.onchange = () => onChange(s.value);
  return s;
}

function slider(label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px';
  const name = document.createElement('span');
  name.textContent = label;
  name.style.cssText = 'width:38px;opacity:0.75';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.style.cssText = 'flex:1;accent-color:#d4a83b';
  const read = document.createElement('span');
  read.textContent = String(value);
  read.style.cssText = 'width:42px;text-align:right;font-variant-numeric:tabular-nums;opacity:0.75';
  input.oninput = () => {
    const v = Number(input.value);
    read.textContent = step < 1 ? v.toFixed(3) : String(v);
    onInput(v);
  };
  wrap.append(name, input, read);
  return wrap;
}
