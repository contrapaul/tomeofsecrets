import { Graphics } from 'pixi.js';
import gsap from 'gsap';
import { initAssets, loadBundle } from './app/assets';
import { DESIGN } from './app/fit';
import { loadFonts } from './app/fonts';
import { Router } from './app/router';
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

  stage.app.ticker.add((t) => router.update(t.deltaMS));
  router.start();

  if (import.meta.env.DEV) {
    // Poke at the running game from the console: __tome.stage, __tome.settings.
    (window as unknown as { __tome: unknown }).__tome = { stage, settings, router, runController: runController(), runApi, eventApi, gsap, audio: audio() };
  }
}

boot().catch((err) => {
  console.error(err);
  document.body.textContent = 'Tome of Secrets could not start. Check the console.';
});
