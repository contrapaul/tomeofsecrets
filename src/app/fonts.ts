/**
 * Loads the self-hosted faces before the first scene renders. Pixi's Text
 * rasterises through canvas 2D, which silently falls back to a system font if
 * the face is not yet in `document.fonts`.
 */
export const FONT = {
  display: 'Cinzel',
  body: 'Alegreya',
  mono: 'JetBrains Mono',
} as const;

const FACES = [
  `700 32px ${FONT.display}`,
  `400 32px ${FONT.body}`,
  `700 32px ${FONT.body}`,
  `italic 400 32px ${FONT.body}`,
  `400 16px "${FONT.mono}"`,
];

/** Long enough for a slow school connection, short enough not to look broken. */
const TIMEOUT_MS = 8000;

/**
 * A face that fails or stalls must not stop the game: `document.fonts.load`
 * rejects on a network error, and a first visit is the one that downloads
 * them. Pixi falls back to a system face, which is plain but playable.
 */
export async function loadFonts(): Promise<void> {
  const deadline = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), TIMEOUT_MS));
  const results = await Promise.race([Promise.allSettled(FACES.map((f) => document.fonts.load(f))), deadline]);
  if (results === 'timeout') console.warn('fonts: still downloading; starting with system faces');
  else {
    const failed = FACES.filter((_, i) => results[i]!.status === 'rejected');
    if (failed.length) console.warn(`fonts: system faces for ${failed.join(', ')}`);
  }
  await Promise.race([document.fonts.ready, deadline]);
}
