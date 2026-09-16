import { MOTION_SCALE, type Motion } from '../../app/settings';

let current: Motion = 'full';

/** Called by the app when settings change; every tween reads through `d()`. */
export function setMotion(m: Motion): void {
  current = m;
}

export function motion(): Motion {
  return current;
}

/** Scale a duration in seconds by the motion setting. */
export function d(seconds: number): number {
  return seconds * MOTION_SCALE[current];
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
