import { Container, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { loadEnemyArt, loadEnemyArtFor } from '../../app/art';
import { DESIGN } from '../../app/fit';
import { FONT } from '../../app/fonts';
import { profileStore } from '../../app/profile';
import type { Scene, SceneContext } from '../../app/router';
import { runController } from '../../app/runController';
import type { ContentRegistry } from '../../content';
import type { ClassId, Page } from '../../content/schema';
import { buyPage, decodeProfile, encodeProfile, pageStatus, unlocks, type Profile } from '../../engine/meta/profile';
import { describeResolved, resolveCard } from '../../engine/rules';
import { CARD_H, CARD_W, CardView } from '../cards/CardView';
import { backdrop } from '../kit/backdrop';
import { Button } from '../kit/button';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { Tooltip } from '../kit/tooltip';
import { relicToken } from '../run/widgets';
import { creditsList } from './credits';

type Tab = 'bestiary' | 'cards' | 'relics' | 'pages' | 'stats' | 'credits';
const TABS: { id: Tab; label: string }[] = [
  { id: 'bestiary', label: 'Bestiary' },
  { id: 'cards', label: 'Cards' },
  { id: 'relics', label: 'Relics' },
  { id: 'pages', label: 'Pages' },
  { id: 'stats', label: 'Stats' },
  { id: 'credits', label: 'Credits' },
];

const CLASS_NAME: Record<string, string> = { paladin: 'Paladin', tracker: 'Tracker', mage: 'Mage', neutral: 'Neutral', secret: 'Secrets' };

/** A face-down card: what you have not found yet. */
function cardBack(scale: number, label = '?'): Container {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(0, 0, CARD_W, CARD_H, 14).fill(PALETTE.inkLight).stroke({ color: PALETTE.gold, width: 3, alpha: 0.5 });
  g.roundRect(14, 14, CARD_W - 28, CARD_H - 28, 10).stroke({ color: PALETTE.gold, width: 2, alpha: 0.25 });
  c.addChild(g);
  const t = makeText(label, { fontFamily: FONT.display, fontWeight: '900', fontSize: 96, fill: PALETTE.gold });
  t.alpha = 0.35;
  t.anchor.set(0.5);
  t.position.set(CARD_W / 2, CARD_H / 2);
  c.addChild(t);
  c.scale.set(scale);
  return c;
}

/** A card with its origin at the top-left corner, so it lays out like the card back. */
function smallCard(content: ContentRegistry, cardId: string, scale: number): Container | null {
  const def = content.cards[cardId];
  if (!def) return null;
  const resolved = resolveCard(def, false);
  const cost = resolved.cost === 'X' ? ('X' as const) : { value: resolved.cost, base: resolved.cost };
  const cv = new CardView(0, def, { resolved, segments: describeResolved(resolved), cost });
  cv.scale.set(scale);
  cv.position.set((CARD_W * scale) / 2, (CARD_H * scale) / 2);
  const c = new Container();
  c.addChild(cv);
  return c;
}

/** The Tome: everything the player has learned and unlocked (docs/design.md §9.5). */
export function tomeScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'tome' });
  const content = runController().content;
  const store = profileStore();
  const tooltip = new Tooltip();
  const body = new Container();
  const tabRow = new Container();
  let loreText: ReturnType<typeof makeText>;

  const profile = (): Profile => store.profile;

  function refreshLore(): void {
    loreText.text = `${profile().lore} LORE`;
  }

  function showTab(t: Tab): void {
    tooltip.hide();
    body.removeChildren().forEach((c) => c.destroy({ children: true }));
    tabRow.removeChildren().forEach((c) => c.destroy({ children: true }));
    TABS.forEach((x, i) => {
      const b = new Button({ label: x.label, width: 200, height: 52, fontSize: 24, variant: x.id === t ? 'gold' : 'ghost', onPress: () => showTab(x.id) });
      b.position.set(DESIGN.width / 2 + (i - (TABS.length - 1) / 2) * 216, 0);
      tabRow.addChild(b);
    });
    ({ bestiary, cards, relics, pages, stats, credits })[t]();
  }

  // ---------------------------------------------------------------- Bestiary

  function bestiary(): void {
    const enemies = Object.values(content.enemies).filter((e) => e.chapter === 1 && e.rank !== 'minion').sort((a, b) => (a.rank === 'boss' ? 2 : a.rank === 'elite' ? 1 : 0) - (b.rank === 'boss' ? 2 : b.rank === 'elite' ? 1 : 0));
    const minions = Object.values(content.enemies).filter((e) => e.chapter === 1 && e.rank === 'minion');
    const all = [...enemies, ...minions];
    const sub = makeText('CHAPTER 1 · THE MOSS HALLS', { ...STYLE.display(22), fill: PALETTE.parchmentDim, letterSpacing: 4 });
    sub.anchor.set(0.5, 0);
    sub.position.set(DESIGN.width / 2, 0);
    body.addChild(sub);
    const cols = 6;
    const tw = 290;
    const th = 236;
    const grid = new Container();
    grid.position.set(DESIGN.width / 2 - (cols * tw) / 2, 50);
    body.addChild(grid);
    const seenIds = all.filter((e) => (profile().bestiary[e.id]?.seen ?? 0) > 0).map((e) => e.id);
    void loadEnemyArtFor(seenIds).then((art) => {
      if (grid.destroyed) return;
      all.forEach((e, i) => {
        const b = profile().bestiary[e.id];
        const seen = (b?.seen ?? 0) > 0;
        const written = (b?.kills ?? 0) > 0;
        const tile = new Container();
        const g = new Graphics();
        g.roundRect(0, 0, tw - 16, th - 16, 14).fill({ color: PALETTE.parchment, alpha: written ? 0.09 : 0.04 }).stroke({ color: written ? PALETTE.gold : PALETTE.parchmentDim, width: 2, alpha: seen ? 1 : 0.4 });
        tile.addChild(g);
        const tex = art.get(e.id);
        if (seen && tex) {
          const s = new Sprite(tex.idle);
          const fit = Math.min(200 / s.width, 140 / s.height);
          s.scale.set(fit);
          s.anchor.set(0.5, 1);
          s.position.set((tw - 16) / 2, 160);
          if (!written) {
            s.tint = 0x000000;
            s.alpha = 0.85;
          }
          tile.addChild(s);
        } else {
          const glyph = makeText(seen ? e.name[0]! : '?', { fontFamily: FONT.display, fontWeight: '900', fontSize: 84, fill: seen ? PALETTE.ink : PALETTE.parchmentDim });
          glyph.anchor.set(0.5);
          glyph.alpha = seen ? 0.9 : 0.35;
          glyph.position.set((tw - 16) / 2, 96);
          if (seen) {
            const blob = new Graphics();
            blob.ellipse((tw - 16) / 2, 100, 62, 62).fill({ color: 0x000000, alpha: 0.85 });
            tile.addChild(blob);
          }
          tile.addChild(glyph);
        }
        const name = makeText(seen ? e.name : '???', { ...STYLE.display(18), fill: written ? PALETTE.parchment : PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: tw - 40, align: 'center' });
        name.anchor.set(0.5, 0);
        name.position.set((tw - 16) / 2, 168);
        tile.addChild(name);
        const meta = makeText(written ? `${b!.kills} slain${e.rank === 'boss' ? ' · boss' : e.rank === 'elite' ? ' · elite' : ''}` : seen ? 'seen, not yet slain' : '', { ...STYLE.mono(14), fill: PALETTE.parchmentDim });
        meta.anchor.set(0.5, 1);
        meta.position.set((tw - 16) / 2, th - 28);
        tile.addChild(meta);
        tile.position.set((i % cols) * tw, Math.floor(i / cols) * th);
        if (seen) {
          tile.eventMode = 'static';
          tile.cursor = 'pointer';
          tile.on('pointertap', () => void openPage(e.id));
          tile.on('pointerover', () => gsap.to(tile.scale, { x: 1.03, y: 1.03, duration: d(0.12) }));
          tile.on('pointerout', () => gsap.to(tile.scale, { x: 1, y: 1, duration: d(0.12) }));
        }
        grid.addChild(tile);
      });
    });
  }

  /** One Bestiary page: art, artist, moves seen, the Secret. */
  async function openPage(id: string): Promise<void> {
    const e = content.enemies[id];
    const b = profile().bestiary[id];
    if (!e || !b) return;
    const art = await loadEnemyArt(id);
    const overlay = new Container();
    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.75 });
    dim.eventMode = 'static';
    dim.on('pointertap', () => overlay.destroy({ children: true }));
    overlay.addChild(dim);
    const W = 1440;
    const H = 780;
    const panel = new Container();
    panel.position.set((DESIGN.width - W) / 2, (DESIGN.height - H) / 2);
    const pg = new Graphics();
    pg.roundRect(0, 0, W, H, 20).fill({ color: 0x14121c, alpha: 0.98 }).stroke({ color: PALETTE.gold, width: 3 });
    pg.eventMode = 'static';
    panel.addChild(pg);
    const written = b.kills > 0;
    // Left: the creature.
    if (art) {
      const s = new Sprite(art.idle);
      const fit = Math.min(480 / s.width, 620 / s.height);
      s.scale.set(fit);
      s.anchor.set(0.5, 1);
      s.position.set(290, 690);
      if (!written) {
        s.tint = 0x000000;
        s.alpha = 0.9;
      }
      panel.addChild(s);
    } else {
      const glyph = makeText(e.name[0]!, { fontFamily: FONT.display, fontWeight: '900', fontSize: 220, fill: written ? PALETTE.parchmentDim : PALETTE.ink });
      glyph.anchor.set(0.5);
      glyph.position.set(290, 400);
      panel.addChild(glyph);
    }
    const credit = art?.artist ? content.credits[art.artist]?.name ?? art.artist : null;
    if (credit && art?.artist !== 'placeholder') {
      const by = makeText(`Drawn by ${credit}`, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
      by.anchor.set(0.5, 0);
      by.position.set(290, 706);
      panel.addChild(by);
    }
    // Right: the facts.
    const x = 600;
    const name = makeText(e.name.toUpperCase(), { ...STYLE.display(38), fill: PALETTE.gold, letterSpacing: 4 });
    name.position.set(x, 40);
    panel.addChild(name);
    const facts = makeText(`${e.tags.join(' · ')}${e.rank && e.rank !== 'normal' ? ` · ${e.rank}` : ''} · ${e.hp[0]}–${e.hp[1]} HP · seen ${b.seen} time${b.seen === 1 ? '' : 's'}${written ? ` · slain ${b.kills}` : ''}`, { ...STYLE.mono(18), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 470 });
    facts.position.set(x, 96);
    panel.addChild(facts);
    if (e.flavour) {
      const fl = makeText(e.flavour, { ...STYLE.body(22), fontStyle: 'italic', fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 470 });
      fl.position.set(x, 96 + facts.height + 12);
      panel.addChild(fl);
    }
    const movesTitle = makeText('MOVES SEEN', { ...STYLE.display(20), fill: PALETTE.parchmentDim, letterSpacing: 4 });
    movesTitle.position.set(x, 300);
    panel.addChild(movesTitle);
    const allMoves = Object.keys(e.moves);
    let y = 336;
    for (const m of allMoves) {
      const def = e.moves[m]!;
      const seen = b.moves.includes(m);
      const label = seen ? `${def.name ?? m}  ·  ${def.intent}` : '?  ·  not yet seen';
      const t = makeText(label, { ...STYLE.body(22), fill: seen ? PALETTE.parchment : PALETTE.parchmentDim });
      t.alpha = seen ? 1 : 0.5;
      t.position.set(x, y);
      panel.addChild(t);
      y += 32;
    }
    // The Secret.
    const secretId = e.secret;
    if (secretId) {
      const st = makeText('ITS SECRET', { ...STYLE.display(20), fill: PALETTE.parchmentDim, letterSpacing: 4 });
      st.position.set(1150, 60);
      panel.addChild(st);
      const card = written ? smallCard(content, secretId, 0.95) : cardBack(0.95);
      if (card) {
        card.position.set(1150, 96);
        panel.addChild(card);
      }
      const note = makeText(written ? 'Stolen. It can appear among your rewards after a fight with this enemy.' : 'Slay it once to steal its Secret.', { ...STYLE.body(18), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 240 });
      note.position.set(1150, 96 + CARD_H * 0.95 + 12);
      panel.addChild(note);
    }
    const hint = makeText('click outside to close', STYLE.mono(16));
    hint.alpha = 0.6;
    hint.anchor.set(1, 1);
    hint.position.set(W - 24, H - 18);
    panel.addChild(hint);
    overlay.addChild(panel);
    view.addChild(overlay);
  }

  // ---------------------------------------------------------------- Cards

  let cardFilter: string = 'paladin';
  function cards(): void {
    const open = unlocks(profile(), content);
    const filters = ['paladin', 'tracker', 'mage', 'neutral', 'secret'];
    filters.forEach((f, i) => {
      const b = new Button({ label: CLASS_NAME[f]!, width: 170, height: 44, fontSize: 20, variant: f === cardFilter ? 'gold' : 'ghost', onPress: () => { cardFilter = f; showTab('cards'); } });
      b.position.set(DESIGN.width / 2 + (i - 2) * 186, 20);
      body.addChild(b);
    });
    const list = Object.values(content.cards).filter((c) => c.class === cardFilter && c.rarity !== 'starter').sort((a, b) => ['common', 'uncommon', 'rare', 'secret'].indexOf(a.rarity) - ['common', 'uncommon', 'rare', 'secret'].indexOf(b.rarity) || a.name.localeCompare(b.name));
    const starters = Object.values(content.cards).filter((c) => c.class === cardFilter && c.rarity === 'starter');
    const all = [...starters, ...list];
    const scale = 0.5;
    const cols = 13;
    const gx = 138;
    const gy = 190;
    const grid = new Container();
    grid.position.set(DESIGN.width / 2 - (cols * gx) / 2 + 8, 80);
    body.addChild(grid);
    let known = 0;
    all.forEach((c, i) => {
      const held = profile().cardsSeen.includes(c.id) || c.rarity === 'starter';
      const isSecret = c.class === 'secret';
      const enemy = isSecret ? Object.values(content.enemies).find((e) => e.secret === c.id) : null;
      const stolen = isSecret && !!enemy && (profile().bestiary[enemy.id]?.kills ?? 0) > 0;
      const unlocked = isSecret ? stolen : open.cards.has(c.id);
      const page = !unlocked && !isSecret ? Object.values(content.pages).find((p) => p.kind === 'cards' && p.unlocks.includes(c.id)) : null;
      let node: Container | null;
      if (!unlocked) {
        node = cardBack(scale, isSecret ? '?' : '🔒');
      } else {
        node = smallCard(content, c.id, scale);
        if (node && !held) node.alpha = 0.55;
        if (unlocked) known++;
      }
      if (!node) return;
      node.position.set((i % cols) * gx, Math.floor(i / cols) * gy);
      node.eventMode = 'static';
      const title = unlocked ? c.name : isSecret ? `A Secret of ${enemy?.name ?? 'someone'}` : 'Not yet unlocked';
      const bodyText = unlocked ? (held ? 'You have held this card.' : 'In the pool, not yet found.') : isSecret ? 'Slay the enemy to steal it.' : `Page: ${page?.name ?? '?'} (${page?.cost ?? '?'} Lore)`;
      node.on('pointerover', () => {
        const p = tooltip.parent!.toLocal(node!.getGlobalPosition());
        tooltip.show(title, bodyText, p.x + 60, p.y + 30);
      });
      node.on('pointerout', () => tooltip.hide());
      grid.addChild(node);
    });
    const sub = makeText(`${known} of ${all.length} ${CLASS_NAME[cardFilter]?.toLowerCase()} cards in the pool`, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
    sub.anchor.set(0.5, 0);
    sub.position.set(DESIGN.width / 2, 0 - 30);
    body.addChild(sub);
  }

  // ---------------------------------------------------------------- Relics

  function relics(): void {
    const open = unlocks(profile(), content);
    const all = Object.values(content.relics).filter((r) => r.tier !== 'starter');
    const cols = 9;
    const gx = 200;
    const gy = 150;
    const grid = new Container();
    grid.position.set(DESIGN.width / 2 - (cols * gx) / 2 + gx / 2, 70);
    body.addChild(grid);
    all.forEach((r, i) => {
      const unlocked = open.relics.has(r.id);
      const held = profile().relicsSeen.includes(r.id);
      const page = unlocked ? null : Object.values(content.pages).find((p) => p.kind === 'relics' && p.unlocks.includes(r.id));
      const token = relicToken(content, r.id, tooltip);
      token.position.set((i % cols) * gx, Math.floor(i / cols) * gy);
      if (!unlocked) {
        token.alpha = 0.3;
        token.removeAllListeners();
        token.on('pointerover', () => {
          const p = tooltip.parent!.toLocal(token.getGlobalPosition());
          tooltip.show(r.name, `Not yet unlocked. Page: ${page?.name ?? '?'} (${page?.cost ?? '?'} Lore).`, p.x + 50, p.y);
        });
        token.on('pointerout', () => tooltip.hide());
      } else if (!held) token.alpha = 0.6;
      grid.addChild(token);
    });
    const sub = makeText(`${all.filter((r) => open.relics.has(r.id)).length} of ${all.length} relics in the pool · bright ones you have carried`, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
    sub.anchor.set(0.5, 0);
    sub.position.set(DESIGN.width / 2, 0);
    body.addChild(sub);
  }

  // ---------------------------------------------------------------- Pages

  let pageGroup = 'paladin';
  function pages(): void {
    const groups: { id: string; label: string; match: (p: Page) => boolean }[] = [
      { id: 'paladin', label: 'Paladin', match: (p) => p.class === 'paladin' && p.kind !== 'boon' },
      { id: 'tracker', label: 'Tracker', match: (p) => p.class === 'tracker' && p.kind !== 'boon' },
      { id: 'mage', label: 'Mage', match: (p) => p.class === 'mage' && p.kind !== 'boon' },
      { id: 'relics', label: 'Relics', match: (p) => p.kind === 'relics' },
      { id: 'boons', label: 'Boons', match: (p) => p.kind === 'boon' },
    ];
    groups.forEach((g, i) => {
      const b = new Button({ label: g.label, width: 170, height: 44, fontSize: 20, variant: g.id === pageGroup ? 'gold' : 'ghost', onPress: () => { pageGroup = g.id; showTab('pages'); } });
      b.position.set(DESIGN.width / 2 + (i - 2) * 186, 20);
      body.addChild(b);
    });
    const group = groups.find((g) => g.id === pageGroup)!;
    const list = Object.values(content.pages).filter(group.match);
    const kindLabel: Record<Page['kind'], string> = { cards: 'Cards', relics: 'Relics', boon: 'Boon', origin: 'Origin', companion: 'Companion' };
    const rows = new Container();
    rows.position.set(DESIGN.width / 2 - 640, 80);
    body.addChild(rows);
    list.forEach((p, i) => {
      const status = pageStatus(profile(), p);
      const y = i * 58;
      const g = new Graphics();
      g.roundRect(0, y, 1280, 50, 10).fill({ color: PALETTE.parchment, alpha: status === 'owned' ? 0.1 : 0.04 }).stroke({ color: status === 'owned' ? PALETTE.gold : PALETTE.parchmentDim, width: 1.5, alpha: status === 'locked' ? 0.3 : 0.8 });
      rows.addChild(g);
      const kind = makeText(kindLabel[p.kind].toUpperCase(), { ...STYLE.mono(14), fill: PALETTE.parchmentDim });
      kind.position.set(16, y + 17);
      rows.addChild(kind);
      const name = makeText(p.name, { ...STYLE.display(22), fill: status === 'locked' ? PALETTE.parchmentDim : PALETTE.parchment });
      name.position.set(130, y + 11);
      rows.addChild(name);
      const what = p.kind === 'cards' ? p.unlocks.map((id) => content.cards[id]?.name ?? id).join(', ') : p.kind === 'relics' ? p.unlocks.map((id) => content.relics[id]?.name ?? id).join(', ') : p.kind === 'boon' ? content.boons[p.unlocks[0]!]?.text ?? '' : p.kind === 'origin' ? content.origins[p.unlocks[0]!]?.blurb ?? '' : p.blurb ?? '';
      const blurb = makeText(what, { ...STYLE.body(17), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 720 });
      blurb.position.set(400, y + (blurb.height > 26 ? 4 : 14));
      rows.addChild(blurb);
      if (status === 'owned') {
        const t = makeText('WRITTEN', { ...STYLE.mono(16), fill: PALETTE.goldBright });
        t.anchor.set(1, 0.5);
        t.position.set(1264, y + 25);
        rows.addChild(t);
      } else if (status === 'locked') {
        const req = content.pages[p.requires!];
        const t = makeText(`after ${req?.name ?? p.requires}`, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
        t.anchor.set(1, 0.5);
        t.position.set(1264, y + 25);
        rows.addChild(t);
      } else {
        const b = new Button({
          label: `${p.cost} Lore`,
          width: 130,
          height: 40,
          fontSize: 18,
          variant: status === 'available' ? 'gold' : 'ghost',
          disabled: status !== 'available',
          onPress: () => {
            if (buyPage(store.profile, content, p.id)) {
              store.save();
              refreshLore();
              showTab('pages');
            }
          },
        });
        b.position.set(1264 - 65, y + 25);
        rows.addChild(b);
      }
    });
    if (!list.length) {
      const none = makeText('Nothing here yet.', { ...STYLE.body(24), fill: PALETTE.parchmentDim });
      none.anchor.set(0.5, 0);
      none.position.set(DESIGN.width / 2, 120);
      body.addChild(none);
    }
  }

  // ---------------------------------------------------------------- Stats

  function stats(): void {
    const p = profile();
    const s = p.stats;
    const cls = (id: string) => content.classes[id]?.name ?? id;
    const fmt = (ms: number | null) => (ms === null ? '—' : `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`);
    const played = Object.entries(s.cardsPlayed).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${content.cards[id]?.name ?? id} ×${n}`);
    const left = [
      `Runs: ${s.runs}`,
      `Wins: ${(['paladin', 'tracker', 'mage'] as ClassId[]).map((c) => `${cls(c)} ${s.wins[c] ?? 0}`).join(' · ')}`,
      `Best floor: ${(['paladin', 'tracker', 'mage'] as ClassId[]).map((c) => `${cls(c)} ${s.bestFloor[c] ?? 0}`).join(' · ')}`,
      `Seals unlocked: ${(['paladin', 'tracker', 'mage'] as ClassId[]).map((c) => `${cls(c)} ${p.seals[c] ?? 0}`).join(' · ')}`,
      `Enemies slain: ${s.kills}`,
      `Bestiary pages: ${Object.values(p.bestiary).filter((b) => b.kills > 0).length} of ${Object.values(content.enemies).filter((e) => e.chapter).length}`,
      `Fastest win: ${fmt(s.fastestWinMs)}`,
      `Lore earned all time: ${p.loreEarned}`,
      played.length ? `Most played: ${played.join(', ')}` : '',
    ].filter(Boolean);
    let y = 20;
    for (const line of left) {
      const t = makeText(line, { ...STYLE.body(24), wordWrap: true, wordWrapWidth: 760 });
      t.position.set(140, y);
      body.addChild(t);
      y += t.height + 12;
    }
    // Save codes.
    const codeTitle = makeText('SAVE CODE', { ...STYLE.display(20), fill: PALETTE.parchmentDim, letterSpacing: 4 });
    codeTitle.position.set(140, y + 30);
    body.addChild(codeTitle);
    const note = makeText('Carry your Tome to another computer: copy the code there, load it here. Loading replaces this Tome.', { ...STYLE.body(20), fill: PALETTE.parchmentDim, wordWrap: true, wordWrapWidth: 760 });
    note.position.set(140, y + 62);
    body.addChild(note);
    const status = makeText('', { ...STYLE.body(20), fill: PALETTE.goldBright, wordWrap: true, wordWrapWidth: 760 });
    status.position.set(140, y + 180);
    body.addChild(status);
    const copy = new Button({
      label: 'Copy code',
      width: 220,
      height: 52,
      fontSize: 22,
      onPress: () => {
        const code = encodeProfile(profile());
        void navigator.clipboard?.writeText(code).then(
          () => { status.text = `Copied. ${code.length} characters.`; },
          () => { window.prompt('Copy this code:', code); },
        );
      },
    });
    copy.position.set(140 + 110, y + 140);
    const load = new Button({
      label: 'Load code',
      width: 220,
      height: 52,
      fontSize: 22,
      variant: 'ghost',
      onPress: () => {
        const code = window.prompt('Paste a Tome save code:');
        if (!code) return;
        const r = decodeProfile(code);
        if (!r.ok) {
          status.text = r.error;
          return;
        }
        store.replace(r.profile);
        refreshLore();
        status.text = 'Loaded.';
        showTab('stats');
      },
    });
    load.position.set(140 + 350, y + 140);
    body.addChild(copy, load);

    // Right: history.
    const hx = 1000;
    const ht = makeText('RUN HISTORY', { ...STYLE.display(20), fill: PALETTE.parchmentDim, letterSpacing: 4 });
    ht.position.set(hx, 20);
    body.addChild(ht);
    if (!p.history.length) {
      const none = makeText('No runs yet.', { ...STYLE.body(22), fill: PALETTE.parchmentDim });
      none.position.set(hx, 60);
      body.addChild(none);
    }
    p.history.forEach((r, i) => {
      const date = new Date(r.date);
      const when = Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}/${date.getDate()}`;
      const line = `${when.padEnd(6)} ${cls(r.classId).padEnd(8)} ${r.result.padEnd(9)} floor ${String(r.floor).padStart(2)}  seal ${r.seal}  +${r.lore} lore${r.killedBy ? `  ·  ${content.enemies[r.killedBy]?.name ?? r.killedBy}` : ''}`;
      const t = makeText(line, { ...STYLE.mono(17), fill: r.result === 'won' ? PALETTE.goldBright : PALETTE.parchment });
      t.position.set(hx, 60 + i * 30);
      body.addChild(t);
    });
  }

  // ---------------------------------------------------------------- Credits

  function credits(): void {
    const list = creditsList(content, 1100);
    list.position.set(DESIGN.width / 2, 20);
    body.addChild(list);
  }

  return {
    view,
    enter(params) {
      view.addChild(backdrop());
      const title = makeText('THE TOME', { ...STYLE.display(56), fill: PALETTE.gold, letterSpacing: 8 });
      title.position.set(140, 50);
      view.addChild(title);
      loreText = makeText('', { ...STYLE.display(30), fill: PALETTE.goldBright, letterSpacing: 3 });
      loreText.anchor.set(1, 0);
      loreText.position.set(DESIGN.width - 140, 66);
      view.addChild(loreText);
      refreshLore();
      tabRow.position.set(0, 160);
      body.position.set(0, 230);
      view.addChild(tabRow, body);
      const back = new Button({ label: 'Back', variant: 'ghost', width: 200, height: 52, onPress: () => ctx.router.go('/') });
      back.position.set(140, DESIGN.height - 60);
      view.addChild(back);
      ctx.stage.overlay.addChild(tooltip);
      const t = params.get('tab') as Tab | null;
      showTab(t && TABS.some((x) => x.id === t) ? t : 'bestiary');
    },
    exit() {
      tooltip.destroy({ children: true });
    },
  };
}
