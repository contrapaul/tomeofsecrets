import { Container } from 'pixi.js';
import type { Scene, SceneContext } from '../../app/router';
import { audio } from '../../app/audio';
import { buy, leaveShop, removeCard } from '../../engine/run/run';
import { DESIGN } from '../../app/fit';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';
import { heading, offerCard, relicToken, vialToken } from './widgets';

/** The Merchant: five cards, three relics, three vials, one card removal. */
export function shopScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['shop'], ({ view, run, content, tooltip, explainer, sync, next, save, showDeck }) => {
    const shop = run.shop!;
    view.addChild(heading('The Merchant', 80, 'Prices are what they are.'));
    const stock = new Container();
    view.addChild(stock);

    const price = (n: number, x: number, y: number, sold: boolean, canAfford: boolean) => {
      const t = makeText(sold ? 'SOLD' : `${n}`, { ...STYLE.mono(22), fill: sold ? PALETTE.parchmentDim : canAfford ? PALETTE.goldBright : 0xe07b7b });
      t.anchor.set(0.5);
      t.position.set(x, y);
      stock.addChild(t);
    };

    const refresh = () => {
      stock.removeChildren().forEach((c) => c.destroy({ children: true }));
      shop.cards.forEach((item, i) => {
        const x = DESIGN.width / 2 + (i - 2) * 250;
        const cv = offerCard(content, item.id, i, 0.78, () => {
          if (buy(run, content, 'cards', i)) {
            audio().play('shop-buy');
            save();
            sync();
            refresh();
          }
        }, explainer);
        if (!cv) return;
        cv.position.set(x, 340);
        if (item.sold) {
          cv.alpha = 0.3;
          cv.eventMode = 'none';
        }
        stock.addChild(cv);
        price(item.price, x, 500, item.sold, run.hero.gold >= item.price);
      });
      shop.relics.forEach((item, i) => {
        const x = DESIGN.width / 2 - 520 + i * 180;
        const t = relicToken(content, item.id, tooltip, () => {
          if (buy(run, content, 'relics', i)) {
            audio().play('shop-buy');
            save();
            sync();
            refresh();
          }
        }, explainer);
        t.position.set(x, 640);
        if (item.sold) t.alpha = 0.3;
        stock.addChild(t);
        price(item.price, x, 740, item.sold, run.hero.gold >= item.price);
      });
      shop.vials.forEach((item, i) => {
        const x = DESIGN.width / 2 + 140 + i * 200;
        const t = vialToken(content, item.id, tooltip, () => {
          if (buy(run, content, 'vials', i)) {
            audio().play('shop-buy');
            save();
            sync();
            refresh();
          }
        }, explainer);
        t.position.set(x, 640);
        if (item.sold) t.alpha = 0.3;
        stock.addChild(t);
        price(item.price, x, 740, item.sold, run.hero.gold >= item.price);
      });
      const remove = new Button({
        label: shop.removed ? 'Removed' : `Remove a card · ${shop.removalPrice}`,
        variant: 'ghost',
        width: 360,
        height: 56,
        disabled: shop.removed || run.hero.gold < shop.removalPrice,
        onPress: () =>
          showDeck({
            title: 'Remove a card',
            pick: 1,
            onDone: (uids) => {
              if (uids[0] !== undefined && removeCard(run, uids[0])) {
                save();
                sync();
                refresh();
              }
              ctx.stage.overlay.children.filter((c) => c.label === 'deck').forEach((c) => c.destroy({ children: true }));
            },
          }),
      });
      remove.position.set(DESIGN.width / 2 - 300, 860);
      stock.addChild(remove);
    };
    refresh();

    const leave = new Button({ label: 'Leave', width: 260, onPress: () => { leaveShop(run); next(); } });
    leave.position.set(DESIGN.width / 2 + 300, 860);
    view.addChild(leave);
  });
}
