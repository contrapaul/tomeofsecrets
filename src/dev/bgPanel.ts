import { ART } from '../app/art';
import { copyLayers, DEFAULT_LAYERS, type LayerName, type LayerSettings } from '../ui/kit/parallax';

const LAYERS: LayerName[] = ['back', 'far', 'mid', 'near', 'overlay'];

/** Named starting points, so there is something to react to rather than a blank slider. */
export const PRESETS: Record<string, LayerSettings> = {
  Tuned: DEFAULT_LAYERS,
  Still: { back: { drift: 0, scale: 1, visible: true }, far: { drift: 0, scale: 1, visible: true }, mid: { drift: 0, scale: 1, visible: true }, near: { drift: 0, scale: 1, visible: true }, overlay: { drift: 0, scale: 1, visible: true } },
  Gentle: { back: { drift: 2, scale: 1.02, visible: true }, far: { drift: 8, scale: 1.03, visible: true }, mid: { drift: 16, scale: 1.04, visible: true }, near: { drift: 0, scale: 1, visible: true }, overlay: { drift: 4, scale: 1.02, visible: true } },
  Strong: { back: { drift: 10, scale: 1.04, visible: true }, far: { drift: 34, scale: 1.08, visible: true }, mid: { drift: 70, scale: 1.12, visible: true }, near: { drift: 0, scale: 1, visible: true }, overlay: { drift: 18, scale: 1.05, visible: true } },
  'No overlay': { ...copyLayers(DEFAULT_LAYERS), overlay: { drift: 8, scale: 1.03, visible: false } },
};

export interface PanelHooks {
  /** The live settings object the panel mutates. */
  settings: LayerSettings;
  apply(): void;
  /** Swap the art set; the scene rebuilds the backdrop. */
  setKey(key: string): void;
  key: string;
  /** True when the watercolour should pass in front of the enemies. */
  overlayInFront: boolean;
  setOverlayInFront(v: boolean): void;
}

/**
 * The dev tuning panel for the fight background: plain DOM over the canvas,
 * because sliders are a solved problem and this never ships to a player.
 * Returns a teardown.
 */
export function openBackgroundPanel(hooks: PanelHooks): () => void {
  let root: HTMLDivElement | null = null;

  const rebuild = (): void => {
    root?.remove();
    root = draw();
    document.body.appendChild(root);
  };

  function draw(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:12px;right:12px;width:290px;max-height:94vh;overflow:auto;z-index:50;padding:14px;border-radius:12px;background:rgba(11,10,15,0.92);border:1px solid #3a3550;color:#efe4c8;font:13px system-ui,sans-serif';
    const h = document.createElement('div');
    h.textContent = 'Background layers';
    h.style.cssText = 'font-size:15px;font-weight:700;color:#d4a83b;margin-bottom:10px';
    el.appendChild(h);

    const pick = document.createElement('select');
    pick.style.cssText = 'width:100%;padding:5px;margin-bottom:8px;font:inherit;background:#14121c;color:#efe4c8;border:1px solid #3a3550;border-radius:5px';
    for (const k of Object.keys(ART.backgrounds)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      if (k === hooks.key) o.selected = true;
      pick.appendChild(o);
    }
    pick.onchange = () => hooks.setKey(pick.value);
    el.appendChild(pick);

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px';
    for (const name of Object.keys(PRESETS)) {
      const b = document.createElement('button');
      b.textContent = name;
      b.style.cssText = 'flex:1 0 auto;padding:5px 8px;font:inherit;color:#0b0a0f;background:#d4a83b;border:0;border-radius:6px;cursor:pointer';
      b.onclick = () => {
        Object.assign(hooks.settings, copyLayers(PRESETS[name]!));
        hooks.apply();
        rebuild();
      };
      bar.appendChild(b);
    }
    el.appendChild(bar);

    for (const name of LAYERS) {
      const s = hooks.settings[name];
      const block = document.createElement('div');
      block.style.cssText = 'margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #2a2535';
      const title = document.createElement('label');
      title.style.cssText = 'display:flex;align-items:center;gap:8px;font-weight:600;color:#d4a83b;text-transform:capitalize';
      const on = document.createElement('input');
      on.type = 'checkbox';
      on.checked = s.visible;
      on.onchange = () => { s.visible = on.checked; hooks.apply(); };
      title.append(on, document.createTextNode(name));
      block.append(title, slider('drift', s.drift, 0, 120, 1, (v) => { s.drift = v; hooks.apply(); }), slider('scale', s.scale, 1, 1.2, 0.005, (v) => { s.scale = v; hooks.apply(); }));
      el.appendChild(block);
    }

    const depth = document.createElement('label');
    depth.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px';
    const dbox = document.createElement('input');
    dbox.type = 'checkbox';
    dbox.checked = hooks.overlayInFront;
    dbox.onchange = () => hooks.setOverlayInFront(dbox.checked);
    depth.append(dbox, document.createTextNode('overlay in front of enemies'));
    el.appendChild(depth);

    const copy = document.createElement('button');
    copy.textContent = 'Copy these numbers';
    copy.style.cssText = 'width:100%;padding:8px;font:inherit;color:#efe4c8;background:transparent;border:1px solid #d4a83b;border-radius:6px;cursor:pointer';
    copy.onclick = () => {
      void navigator.clipboard?.writeText(JSON.stringify({ background: hooks.key, overlayInFront: hooks.overlayInFront, layers: hooks.settings }, null, 2));
      copy.textContent = 'Copied — paste it to Claude';
      setTimeout(() => { copy.textContent = 'Copy these numbers'; }, 1800);
    };
    el.appendChild(copy);
    return el;
  }

  rebuild();
  return () => root?.remove();
}

function slider(label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px';
  const name = document.createElement('span');
  name.textContent = label;
  name.style.cssText = 'width:34px;opacity:0.75';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.style.cssText = 'flex:1;accent-color:#d4a83b';
  const read = document.createElement('span');
  read.textContent = String(value);
  read.style.cssText = 'width:40px;text-align:right;font-variant-numeric:tabular-nums;opacity:0.75';
  input.oninput = () => {
    const v = Number(input.value);
    read.textContent = step < 1 ? v.toFixed(3) : String(v);
    onInput(v);
  };
  wrap.append(name, input, read);
  return wrap;
}
