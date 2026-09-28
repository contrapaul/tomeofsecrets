import { Graphics, Sprite, type Container } from 'pixi.js';
import { loadTokenArt } from '../../app/art';

/**
 * Swap a token's initial for its drawing when there is one. Relic and vial
 * tokens are built before the texture exists — in the bar, the Tome, rewards,
 * the shop — so the art arrives behind them and hides the letter. Nothing
 * waits on it: an undrawn relic keeps its initial forever, which is fine.
 *
 * Every token is centred on its container's origin, so the sprite is too.
 */
export function fillTokenArt(host: Container, kind: 'relics' | 'vials', id: string, shape: { width: number; height: number; radius: number }, initial: Container): void {
  void loadTokenArt(kind, id).then((tex) => {
    if (!tex || host.destroyed) return;
    const { width, height, radius } = shape;
    const sprite = new Sprite(tex);
    sprite.width = width;
    sprite.height = height;
    sprite.position.set(-width / 2, -height / 2);
    // Inset by the border width so the token keeps its gold or frost rim.
    const mask = new Graphics();
    if (radius >= Math.min(width, height) / 2) mask.circle(0, 0, radius - 2).fill(0xffffff);
    else mask.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, radius).fill(0xffffff);
    sprite.mask = mask;
    host.addChild(mask, sprite);
    initial.visible = false;
  });
}
