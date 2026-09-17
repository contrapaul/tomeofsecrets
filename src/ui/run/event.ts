import { Container, Graphics } from 'pixi.js';
import type { Scene, SceneContext } from '../../app/router';
import { advance, choose, eventPortraits, eventTitle, pick, type Beat } from '../../engine/run/events';
import { leaveEvent } from '../../engine/run/run';
import { DESIGN } from '../../app/fit';
import { FONT } from '../../app/fonts';
import { Button } from '../kit/button';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import { runScene } from './base';

const SPEAKER_NAMES: Record<string, string> = { seeker: 'You', archivist: 'The Archivist', bookseller: 'The Bookseller', scholar: 'The Scholar', bandit: 'Bandit' };

/**
 * A story beat or event: a portrait each side, lines between, choices below.
 * Reads the dialogue state, so a resumed run redraws exactly where it was.
 */
export function eventScene(ctx: SceneContext): Scene {
  return runScene(ctx, ['event'], ({ view, run, content, sync, next, save, showDeck }) => {
    const ev = run.event!;
    const st = ev.state;
    const portraits = eventPortraits(ev.file);
    const cls = content.classes[run.hero.classId];

    const title = makeText(eventTitle(ev.file).toUpperCase(), { ...STYLE.display(34), fill: PALETTE.gold, letterSpacing: 5 });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN.width / 2, 100);
    view.addChild(title);

    // Portraits: placeholders until art lands. The seeker on the left, the other party on the right.
    const portrait = (id: string | undefined, side: 'left' | 'right') => {
      if (!id) return;
      const c = new Container();
      const g = new Graphics();
      g.roundRect(-140, -180, 280, 360, 24).fill({ color: PALETTE.inkLight }).stroke({ color: side === 'left' ? PALETTE.class[run.hero.classId] : PALETTE.gold, width: 4 });
      c.addChild(g);
      const name = id === 'seeker' ? (cls?.name ?? 'You') : SPEAKER_NAMES[id] ?? id;
      const initial = makeText(name[0]!, { fontFamily: FONT.display, fontWeight: '900', fontSize: 120, fill: side === 'left' ? PALETTE.class[run.hero.classId] : PALETTE.gold });
      initial.anchor.set(0.5);
      initial.alpha = 0.6;
      c.addChild(initial);
      const label = makeText(name.toUpperCase(), { ...STYLE.display(20), fill: PALETTE.parchmentDim, letterSpacing: 2 });
      label.anchor.set(0.5, 0);
      label.position.set(0, 196);
      c.addChild(label);
      c.position.set(side === 'left' ? 260 : DESIGN.width - 260, 470);
      view.addChild(c);
    };
    portrait(portraits.left?.id ?? 'seeker', 'left');
    portrait(portraits.right?.id, 'right');

    const panel = new Graphics();
    panel.roundRect(440, 250, 1040, 470, 18).fill({ color: 0x000000, alpha: 0.55 }).stroke({ color: PALETTE.gold, width: 2, alpha: 0.6 });
    view.addChild(panel);
    const textArea = new Container();
    view.addChild(textArea);
    const controls = new Container();
    view.addChild(controls);

    const render = () => {
      textArea.removeChildren().forEach((c) => c.destroy({ children: true }));
      controls.removeChildren().forEach((c) => c.destroy({ children: true }));
      // The last few beats, newest at the bottom.
      const shown: Beat[] = st.beats.slice(-6);
      let y = 690;
      for (const beat of [...shown].reverse()) {
        const isNote = beat.kind === 'note';
        const text = isNote ? beat.text : beat.speaker ? `${SPEAKER_NAMES[beat.speaker] ?? (beat.speaker === 'seeker' ? cls?.name : beat.speaker)}:  ${beat.text}` : beat.text;
        const t = makeText(text, { ...STYLE.body(isNote ? 20 : 26), fill: isNote ? PALETTE.goldBright : PALETTE.parchment, fontStyle: isNote ? 'italic' : 'normal', wordWrap: true, wordWrapWidth: 980 });
        y -= t.height + 14;
        if (y < 270) break;
        t.position.set(470, y);
        textArea.addChild(t);
      }

      if (st.waiting === 'continue') {
        const b = new Button({ label: 'Continue', width: 260, height: 56, onPress: () => { advance(run, content); save(); sync(); render(); } });
        b.position.set(DESIGN.width / 2, 790);
        controls.addChild(b);
      } else if (st.waiting === 'choice') {
        st.choices.forEach((c, i) => {
          const long = c.label.length > 28;
          const b = new Button({ label: c.label, width: long ? 900 : 420, height: 56, fontSize: long ? 22 : 26, variant: i === 0 ? 'gold' : 'ghost', onPress: () => { choose(run, content, i); save(); sync(); afterStep(); } });
          b.position.set(DESIGN.width / 2, 790 + i * 68);
          controls.addChild(b);
        });
      } else if (st.waiting === 'pick') {
        const p = st.pick!;
        const label = p.kind === 'remove' ? 'Remove' : p.kind === 'upgrade' ? 'Upgrade' : 'Transform';
        showDeck({
          title: `${label} ${p.count > 1 ? `${p.count} cards` : 'a card'}`,
          pick: p.count,
          eligible: p.kind === 'upgrade' ? (c) => !c.upgraded : undefined,
          preview: p.kind === 'upgrade' ? 'upgraded' : undefined,
          cancelLabel: 'Skip',
          onDone: (uids) => {
            ctx.stage.overlay.children.filter((c) => c.label === 'deck').forEach((c) => c.destroy({ children: true }));
            pick(run, content, uids);
            save();
            sync();
            afterStep();
          },
        });
      } else if (st.waiting === 'fight') {
        next();
      } else {
        const b = new Button({ label: 'Onward', width: 260, height: 56, onPress: () => { leaveEvent(run); next(); } });
        b.position.set(DESIGN.width / 2, 790);
        controls.addChild(b);
      }
    };
    const afterStep = () => {
      if (run.phase === 'fight') next();
      else render();
    };
    render();
  });
}
