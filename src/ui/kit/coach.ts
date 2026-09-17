import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { Stage } from '../../app/stage';
import { Button } from './button';
import { d, spatial } from './motion';
import { PALETTE } from './palette';
import { makeText, STYLE } from './text';

export interface CoachStep {
  title: string;
  text: string;
  /** Actions that complete the step. None means a "Got it" button does. */
  until?: string[];
  /** Keep the step hidden until this action is seen. */
  after?: string;
  /** Points to mark with a chevron, in the coach's parent space; read every frame. */
  point?: () => ({ x: number; y: number } | null)[];
}

const W = 700;
const PAD = 28;

/**
 * A guided walkthrough: one step at a time, and a step ends only when the
 * player does what it asks (or reads it and presses Got it). The scene calls
 * `notify` with what the player just did. Never blocks the game.
 */
export class Coach extends Container {
  private index = -1;
  private waitingFor: string | null = null;
  private finished = false;
  private readonly panel = new Container({ label: 'coach-panel' });
  private readonly marks = new Container({ label: 'coach-marks' });
  private readonly chevrons: Graphics[] = [];
  private readonly tick: () => void;
  private t = 0;

  constructor(private readonly stage: Stage, private readonly steps: CoachStep[], at: { x: number; y: number }, private readonly onDone: () => void) {
    super({ label: 'coach' });
    this.panel.position.set(at.x, at.y);
    this.addChild(this.marks, this.panel);
    this.tick = () => {
      this.t += this.stage.app.ticker.deltaMS / 1000;
      const step = this.steps[this.index];
      const points = this.waitingFor || !step?.point ? [] : step.point();
      this.chevrons.forEach((c, i) => {
        const p = points[i];
        c.visible = !!p;
        if (p) c.position.set(p.x, p.y - 14 + (spatial() ? Math.sin(this.t * 7 + i) * 8 : 0));
      });
    };
    stage.app.ticker.add(this.tick);
    this.once('destroyed', () => stage.app.ticker.remove(this.tick));
  }

  start(): void {
    this.show(0);
  }

  /** The player did something; the current step may be waiting for it. */
  notify(action: string): void {
    if (this.finished) return;
    if (this.waitingFor === action) {
      this.waitingFor = null;
      this.render();
      return;
    }
    const step = this.steps[this.index];
    if (step?.until?.includes(action)) this.advance();
  }

  private advance(): void {
    if (this.index + 1 >= this.steps.length) this.finish();
    else this.show(this.index + 1);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.marks.visible = false;
    gsap.to(this, { alpha: 0, duration: d(0.25), onComplete: () => this.destroy({ children: true }) });
    this.onDone();
  }

  private show(i: number): void {
    this.index = i;
    const step = this.steps[i]!;
    this.waitingFor = step.after ?? null;
    this.render();
  }

  private render(): void {
    const step = this.steps[this.index]!;
    this.panel.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.chevrons.splice(0).forEach((c) => c.destroy());
    if (this.waitingFor) return;

    const counter = makeText(`${this.index + 1} / ${this.steps.length}`, { ...STYLE.mono(16), fill: PALETTE.parchmentDim });
    counter.anchor.set(1, 0);
    counter.position.set(W - PAD, 24);
    const title = makeText(step.title.toUpperCase(), { ...STYLE.display(24), fill: PALETTE.gold });
    title.position.set(PAD, 20);
    const body = makeText(step.text, { ...STYLE.body(24), wordWrap: true, wordWrapWidth: W - PAD * 2 });
    body.position.set(PAD, 60);
    let h = 60 + Math.ceil(body.height) + 14;

    const bg = new Graphics();
    this.panel.addChild(bg, counter, title, body);
    if (!step.until) {
      const ok = new Button({ label: 'Got it', width: 160, height: 44, fontSize: 22, onPress: () => this.advance() });
      ok.position.set(PAD + 80, h + 22);
      this.panel.addChild(ok);
      h += 58;
    } else {
      h += 22;
    }
    const skip = makeText('skip tutorial', { ...STYLE.mono(15), fill: PALETTE.parchmentDim });
    skip.anchor.set(1, 1);
    skip.position.set(W - PAD, h - 12);
    skip.alpha = 0.7;
    skip.eventMode = 'static';
    skip.cursor = 'pointer';
    skip.on('pointertap', () => this.finish());
    this.panel.addChild(skip);

    bg.roundRect(0, 0, W, h, 14).fill({ color: PALETTE.ink, alpha: 0.92 }).stroke({ color: PALETTE.gold, width: 2 });
    this.panel.eventMode = 'static';
    this.panel.alpha = 0;
    gsap.to(this.panel, { alpha: 1, duration: d(0.2) });

    const n = step.point?.().length ?? 0;
    for (let k = 0; k < n; k++) {
      const g = new Graphics();
      g.poly([0, 0, -18, -30, 18, -30]).fill({ color: PALETTE.goldBright }).stroke({ color: PALETTE.ink, width: 3, join: 'round' });
      g.visible = false;
      this.marks.addChild(g);
      this.chevrons.push(g);
    }
  }
}
