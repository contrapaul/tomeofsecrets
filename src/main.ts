import { Graphics } from 'pixi.js';
import gsap from 'gsap';
import { initAssets, loadBundle } from './app/assets';
import { DESIGN } from './app/fit';
import { loadFonts } from './app/fonts';
import { Router } from './app/router';
import { account } from './app/account';
import { openAccountUi, openMessage } from './app/accountUi';
import { audio, initAudio } from './app/audio';
import { defaultSettings, SettingsStore } from './app/settings';
import { Stage } from './app/stage';
import { devCardsScene } from './dev/cards';
import { devEnemyScene } from './dev/enemy';
import { devFightScene } from './dev/fight';
import { devStatsScene } from './dev/stats';
import { devTextScene } from './dev/text';
import { PALETTE } from './ui/kit/palette';
import { setMotion } from './ui/kit/motion';
import { bindTextToStage } from './ui/kit/text';
import { creditsScene } from './ui/scenes/credits';
import { bossRewardScene } from './ui/run/bossReward';
import { campScene } from './ui/run/camp';
import { runEndScene } from './ui/run/end';
import { eventScene } from './ui/run/event';
import { runFightScene } from './ui/run/fight';
import { mapScene } from './ui/run/map';
import { newRunScene } from './ui/run/newRun';
import { rewardScene } from './ui/run/reward';
import { shopScene } from './ui/run/shop';
import { treasureScene } from './ui/run/treasure';
import { settingsScene } from './ui/scenes/settings';
import { tomeScene } from './ui/scenes/tome';
import { titleScene } from './ui/scenes/title';
import { runController } from './app/runController';
import * as runApi from './engine/run/run';
import * as eventApi from './engine/run/events';

async function boot(): Promise<void> {
  const stage = await Stage.create(PALETTE.letterbox);
  bindTextToStage(stage);
  gsap.ticker.lagSmoothing(0);

  // Loading bar: drawn before fonts exist, so no text.
  const bar = new Graphics();
  stage.overlay.addChild(bar);
  const paint = (p: number) => {
    bar.clear();
    bar.rect(DESIGN.width / 2 - 200, DESIGN.height / 2 - 4, 400, 8).fill({ color: PALETTE.parchment, alpha: 0.15 });
    bar.rect(DESIGN.width / 2 - 200, DESIGN.height / 2 - 4, 400 * p, 8).fill(PALETTE.gold);
  };
  paint(0);

  await loadFonts();
  paint(0.4);
  await initAssets();
  await loadBundle('core', (p) => paint(0.4 + 0.6 * p));
  bar.destroy();

  let storage: Storage | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const settings = new SettingsStore(storage, defaultSettings(window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  setMotion(settings.get().motion);
  settings.on((s) => setMotion(s.motion));
  initAudio(settings);

  const router = new Router({ stage, settings })
    .register('/', titleScene)
    .register('/settings', settingsScene)
    .register('/credits', creditsScene)
    .register('/tome', tomeScene)
    .register('/run/new', newRunScene)
    .register('/run/map', mapScene)
    .register('/run/fight', runFightScene)
    .register('/run/reward', rewardScene)
    .register('/run/shop', shopScene)
    .register('/run/camp', campScene)
    .register('/run/treasure', treasureScene)
    .register('/run/event', eventScene)
    .register('/run/boss-reward', bossRewardScene)
    .register('/run/end', runEndScene)
    .register('/dev/stats', devStatsScene)
    .register('/dev/text', devTextScene)
    .register('/dev/cards', devCardsScene)
    .register('/dev/fight', devFightScene)
    .register('/dev/enemy', devEnemyScene);

  // Who is signed in, before any scene reads the Tome; the right one must be loaded first.
  await account().init();
  stage.app.ticker.add((t) => router.update(t.deltaMS));
  router.start();
  handleEmailLinks(router);

  if (import.meta.env.DEV) {
    // Poke at the running game from the console: __tome.stage, __tome.settings.
    (window as unknown as { __tome: unknown }).__tome = { stage, settings, router, runController: runController(), runApi, eventApi, gsap, audio: audio() };
  }
}

/** `?verify=` and `?reset=` come from the emails; act, then drop them from the URL. */
function handleEmailLinks(router: Router): void {
  const q = new URLSearchParams(window.location.search);
  const verify = q.get('verify');
  const reset = q.get('reset');
  if (!verify && !reset) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  if (verify) {
    void account()
      .verify(verify)
      .then(() => openMessage('Email verified', 'Your account is confirmed. Thanks.', { onChange: () => router.reload() }))
      .catch((e: Error) => openMessage('That link did not work', e.message));
  }
  if (reset) openAccountUi('newPassword', { token: reset, onChange: () => router.reload() });
}

boot().catch((err: unknown) => {
  console.error(err);
  // Students have no console: say what broke, on the page, with a way to retry.
  document.body.textContent = '';
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;font-family:system-ui,sans-serif;color:#e8e0cc;background:#0b0a0f';
  const title = document.createElement('h1');
  title.textContent = 'Tome of Secrets could not start.';
  title.style.cssText = 'font-size:24px;margin:0';
  const hint = document.createElement('p');
  hint.textContent = 'Reload the page. If it keeps happening, show Mr. K the line below.';
  hint.style.cssText = 'margin:0;opacity:0.8;max-width:34em';
  const detail = document.createElement('pre');
  detail.textContent = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  detail.style.cssText = 'margin:0;padding:12px;max-width:90vw;overflow:auto;font-size:13px;opacity:0.7;border:1px solid #3a3550;border-radius:8px';
  const again = document.createElement('button');
  again.textContent = 'Reload';
  again.style.cssText = 'padding:10px 24px;font:inherit;color:#0b0a0f;background:#d4af5a;border:0;border-radius:8px;cursor:pointer';
  again.onclick = () => window.location.reload();
  panel.append(title, hint, detail, again);
  document.body.append(panel);
});
