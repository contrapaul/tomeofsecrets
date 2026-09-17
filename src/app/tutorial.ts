/**
 * Which guided walkthroughs this browser has finished. Each plays once; the
 * Settings screen can reset them.
 */
export type TutorialId = 'map' | 'fight';

const KEY = 'tome.tutorial.v1';

function read(): Partial<Record<TutorialId, boolean>> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<TutorialId, boolean>>) : {};
  } catch {
    return {};
  }
}

export function tutorialPending(id: TutorialId): boolean {
  return !read()[id];
}

export function markTutorial(id: TutorialId): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: true }));
  } catch {
    // Storage blocked: it will play again next time, which is harmless.
  }
}

export function resetTutorials(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
