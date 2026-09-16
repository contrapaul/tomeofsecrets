/**
 * The palette, as numbers for Pixi. Mirrors docs/mood.html; change both.
 */
export const PALETTE = {
  letterbox: 0x06060a,
  ink: 0x0b0a0f,
  inkLight: 0x1a1724,
  parchment: 0xefe4c8,
  parchmentDim: 0xbfb193,
  gold: 0xd4a83b,
  goldBright: 0xf2cf6b,
  blood: 0x9b2335,
  moss: 0x5d7a3a,
  ember: 0xe0662b,
  frost: 0x6fb3d9,
  arcane: 0x8b6ad8,
  class: {
    paladin: 0xd4a83b,
    tracker: 0x6f8f3f,
    mage: 0x6b5fd3,
  },
  type: {
    attack: 0xa8352f,
    skill: 0x3d7a5e,
    power: 0x3f5fa8,
    status: 0x6b6b6b,
    curse: 0x4a2a5a,
    secret: 0x8a6d2b,
  },
} as const;
