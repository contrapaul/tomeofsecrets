import { MOTION_SCALE, type Motion } from '../../app/settings';

let current: Motion = 'full';
/** How much longer the enemies' turn runs; 1 is the same pace as the hero's. */
let enemyScale = 1;
let duringEnemyTurn = false;

/** Called by the app when settings change; every tween reads through `d()`. */
export function setMotion(m: Motion): void {
  current = m;
}

export function motion(): Motion {
  return current;
}

/** Called by the app when settings change, like `setMotion`. */
export function setEnemyPace(scale: number): void {
  enemyScale = scale;
}

/**
 * Playback marks the enemies' turn, which runs slower than the hero's so a new
 * player can see what hit them. Reset on leaving a fight.
 */
export function enemyTurn(on: boolean): void {
  duringEnemyTurn = on;
}

/** Scale a duration in seconds by the motion setting, and by the enemy's pace. */
export function d(seconds: number): number {
  return seconds * MOTION_SCALE[current] * (duringEnemyTurn ? enemyScale : 1);
}

/** Under reduced motion, spatial effects (lunges, shakes) are skipped entirely. */
export function spatial(): boolean {
  return current !== 'reduced';
}

/** GSAP's `then` resolves with the animation; this gives a plain `Promise<void>`. */
export function done(anim: { then(onFulfilled?: (v: unknown) => unknown): Promise<unknown> }): Promise<void> {
  return new Promise((resolve) => {
    void anim.then(() => resolve());
  });
}
