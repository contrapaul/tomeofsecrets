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

export async function loadFonts(): Promise<void> {
  await Promise.all(FACES.map((f) => document.fonts.load(f)));
  await document.fonts.ready;
}
