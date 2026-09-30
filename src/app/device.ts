/**
 * Which layout the game draws for.
 *
 * The design space never changes: a phone gets the same 1920×1080 scene. What
 * changes is how big the parts that carry information are drawn inside it,
 * because a phone renders that space at about a third of its size — a 15px
 * number lands at 5 CSS pixels, which is why a card has to be tapped to be
 * read. Phone mode draws those parts larger and adds the touch affordances
 * (pan the map, press a card to read it).
 *
 * Decided once at boot. Rotating a phone does not change it, and neither does
 * resizing a window: a scene reads the layout while it builds, so changing it
 * underneath a live scene would only half-apply.
 */

export type LayoutKind = 'desktop' | 'phone';

/** Above this, a touch screen is a tablet and gets the desktop layout. */
const PHONE_SHORT_SIDE = 500;

/** Pure: the layout a `w`×`h` viewport with this kind of pointer wants. */
export function layoutFor(w: number, h: number, coarse: boolean): LayoutKind {
  return coarse && Math.min(w, h) <= PHONE_SHORT_SIDE ? 'phone' : 'desktop';
}

/** `?layout=phone` forces it on a desktop, `?layout=desktop` off on a phone. */
export function layoutFromQuery(search: string): LayoutKind | null {
  const asked = new URLSearchParams(search).get('layout');
  return asked === 'phone' || asked === 'desktop' ? asked : null;
}

let current: LayoutKind = 'desktop';

/** Called once at boot, before any scene is built. Returns what it settled on. */
export function initLayout(): LayoutKind {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  current = layoutFromQuery(window.location.search) ?? layoutFor(window.innerWidth, window.innerHeight, coarse);
  return current;
}

export function layout(): LayoutKind {
  return current;
}

export function isPhone(): boolean {
  return current === 'phone';
}

/** Test seam: set the layout directly. */
export function setLayout(kind: LayoutKind): void {
  current = kind;
}
