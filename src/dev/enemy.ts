import { Container, Graphics } from 'pixi.js';
import { loadContent } from '../content';
import { ART, loadEnemyArt, texturesFromBitmap, type EnemyTextures } from '../app/art';
import { DESIGN } from '../app/fit';
import type { Scene, SceneContext } from '../app/router';
import type { Enemy } from '../content/schema';
import { EnemyView } from '../ui/combat/EnemyView';
import { backdrop } from '../ui/kit/backdrop';
import { Button } from '../ui/kit/button';
import { PALETTE } from '../ui/kit/palette';
import { makeText, STYLE } from '../ui/kit/text';
import { Explainer } from '../ui/kit/explainer';

const SIZES = ['small', 'medium', 'large'] as const;
type Size = (typeof SIZES)[number];

/**
 * #/dev/enemy?id=dummy-brute — the puppet preview. Drop a PNG anywhere on the
 * page to see it as an enemy: idle, attack, hit, buff, die. Pick a size class,
 * type an id and your credits id, export the meta.json.
 */
export function devEnemyScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'dev-enemy' });
  const content = loadContent({ fixtures: true });
  const explainer = new Explainer(content, ctx.stage);
  const fx = new Container();
  let enemy: EnemyView | null = null;
  let art: EnemyTextures | null = null;
  let size: Size = 'medium';
  let loopTimer: ReturnType<typeof setInterval> | null = null;
  let form: HTMLDivElement | null = null;
  const status = makeText('', { ...STYLE.body(22), fill: PALETTE.parchmentDim });
  const sizeButtons: Button[] = [];

  function def(): Enemy {
    const base = content.enemies['dummy-brute']!;
    return { ...base, id: 'preview', name: (form?.querySelector<HTMLInputElement>('[name=id]')?.value || 'your enemy').replace(/-/g, ' '), size };
  }

  function rebuild(): void {
    enemy?.destroy({ children: true });
    const inst = { id: 'preview', enemyId: 'preview', name: def().name, hp: 40, maxHp: 40, block: 0, statuses: {}, intent: { move: 'x', kind: 'attack' as const, hidden: false, damage: 7, hits: 1 }, history: [], usedOnce: [], flags: {}, phase: -1, alive: true, memory: {} };
    enemy = new EnemyView(inst, def(), art, explainer, fx);
    enemy.position.set(DESIGN.width / 2 + 200, 700);
    view.addChild(enemy);
    view.addChild(fx);
    status.text = art ? `${size} · ${art.idle.width}×${art.idle.height}${art.attack ? ' · attack pose' : ''}${art.sheet ? ' · spritesheet' : ''}` : 'no art: placeholder body';
  }

  async function play(what: 'attack' | 'hit' | 'buff' | 'die'): Promise<void> {
    if (!enemy) return;
    if (what === 'attack') await enemy.attack();
    else if (what === 'hit') await enemy.hit(9, 0, 9);
    else if (what === 'buff') enemy.buff();
    else {
      await enemy.die();
      setTimeout(rebuild, 400);
    }
  }

  function loop(): void {
    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
      return;
    }
    const seq: ('attack' | 'hit' | 'buff' | 'die')[] = ['attack', 'hit', 'buff', 'attack', 'hit', 'die'];
    let i = 0;
    loopTimer = setInterval(() => void play(seq[i++ % seq.length]!), 1600);
  }

  async function onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const bitmap = await createImageBitmap(file);
    art = texturesFromBitmap(bitmap, size);
    // Guess the size class from the image.
    const guess = SIZES.find((s) => ({ small: 400, medium: 600, large: 900 })[s] === bitmap.height);
    if (guess) setSize(guess);
    else rebuild();
    status.text += `  · dropped ${file.name}`;
  }
  const onDragOver = (e: DragEvent) => e.preventDefault();

  function setSize(s: Size): void {
    size = s;
    if (art) art = { ...art, size: s };
    sizeButtons.forEach((b, i) => (b.alpha = SIZES[i] === s ? 1 : 0.55));
    rebuild();
  }

  function exportMeta(): void {
    const id = form?.querySelector<HTMLInputElement>('[name=id]')?.value || 'your-enemy-id';
    const artist = form?.querySelector<HTMLInputElement>('[name=artist]')?.value || 'your-credits-id';
    const meta = { id, size, artist, notes: '' };
    const blob = new Blob([JSON.stringify(meta, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'meta.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return {
    view,
    async enter(params) {
      view.addChild(backdrop());
      ctx.stage.overlay.addChild(explainer);
      const title = makeText('DEV · ENEMY PREVIEW', { ...STYLE.display(36), fill: PALETTE.gold });
      title.position.set(60, 50);
      view.addChild(title);
      const hint = makeText('Drop a PNG anywhere on this page. It should be 400×400, 600×600 or 700×640 with the feet 40 px from the bottom, facing left.', { ...STYLE.body(22), wordWrap: true, wordWrapWidth: 700 });
      hint.position.set(60, 110);
      view.addChild(hint);
      status.position.set(60, 190);
      view.addChild(status);

      const floor = new Graphics();
      floor.moveTo(700, 700).lineTo(1800, 700).stroke({ color: PALETTE.gold, width: 2, alpha: 0.4 });
      view.addChild(floor);
      const floorLabel = makeText('feet line', { ...STYLE.mono(14), fill: PALETTE.gold });
      floorLabel.position.set(1720, 706);
      view.addChild(floorLabel);

      let y = 260;
      SIZES.forEach((s) => {
        const b = new Button({ label: s, width: 200, height: 52, variant: 'ghost', onPress: () => setSize(s) });
        b.position.set(160, y);
        y += 62;
        sizeButtons.push(b);
        view.addChild(b);
      });
      y += 20;
      for (const [label, what] of [['Attack', 'attack'], ['Hit', 'hit'], ['Buff', 'buff'], ['Die', 'die']] as const) {
        const b = new Button({ label, width: 200, height: 52, onPress: () => void play(what) });
        b.position.set(160, y);
        y += 62;
        view.addChild(b);
      }
      const loopBtn = new Button({ label: 'Loop all', width: 200, height: 52, variant: 'ghost', onPress: loop });
      loopBtn.position.set(160, y);
      y += 62;
      view.addChild(loopBtn);
      const exp = new Button({ label: 'Export meta', width: 200, height: 52, variant: 'ghost', onPress: exportMeta });
      exp.position.set(160, y + 20);
      view.addChild(exp);
      const back = new Button({ label: 'Back', width: 200, height: 52, variant: 'ghost', onPress: () => ctx.router.go('/dev/stats') });
      back.position.set(160, DESIGN.height - 80);
      view.addChild(back);

      // Two text fields is the one place a DOM form beats drawing one. Dev only.
      form = document.createElement('div');
      form.style.cssText = 'position:fixed;left:16px;bottom:16px;display:flex;gap:8px;font:14px "JetBrains Mono",monospace;';
      form.innerHTML = `<input name="id" placeholder="enemy id (e.g. moss-beetle)" style="padding:8px;width:220px;background:#14121c;color:#efe4c8;border:1px solid #d4a83b;border-radius:6px">
        <input name="artist" placeholder="your credits id" style="padding:8px;width:180px;background:#14121c;color:#efe4c8;border:1px solid #d4a83b;border-radius:6px">`;
      document.body.appendChild(form);
      form.querySelector<HTMLInputElement>('[name=id]')?.addEventListener('input', rebuild);

      window.addEventListener('dragover', onDragOver);
      window.addEventListener('drop', onDrop);

      const id = params.get('id');
      if (id && ART.enemies[id]) {
        art = await loadEnemyArt(id);
        size = ART.enemies[id]!.size;
      }
      setSize(size);
    },
    exit() {
      if (loopTimer) clearInterval(loopTimer);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      form?.remove();
      explainer.destroy({ children: true });
    },
  };
}
