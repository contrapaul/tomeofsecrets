import { Assets, type AssetsManifest, type ProgressCallback } from 'pixi.js';

/**
 * Bundles are loaded per screen, never all at once: `core` before the title,
 * a chapter's bundle when its map opens. Phase 4 fills these in from the
 * atlas packer; until then the loader is exercised on empty bundles so the
 * loading screen and progress path are real.
 */
export const MANIFEST: AssetsManifest = {
  bundles: [
    { name: 'core', assets: [] },
    { name: 'chapter1', assets: [] },
    { name: 'chapter2', assets: [] },
    { name: 'chapter3', assets: [] },
  ],
};

export async function initAssets(): Promise<void> {
  await Assets.init({ manifest: MANIFEST });
}

export async function loadBundle(name: string, onProgress?: ProgressCallback): Promise<void> {
  const bundle = MANIFEST.bundles.find((b) => b.name === name);
  if (!bundle || (Array.isArray(bundle.assets) ? bundle.assets.length === 0 : Object.keys(bundle.assets).length === 0)) {
    onProgress?.(1);
    return;
  }
  await Assets.loadBundle(name, onProgress);
}
