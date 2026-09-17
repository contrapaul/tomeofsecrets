/**
 * The .dlg format, docs/design.md §10. Plain text, one file per event or
 * story beat. This parser is deliberately forgiving about whitespace and
 * strict about structure, so a student's typo says which line is wrong.
 */

export interface Condition {
  raw: string;
}

export type Line =
  | { kind: 'say'; speaker: string | null; text: string; line: number }
  | { kind: 'choice'; options: { label: string; target: string; cond?: string }[]; line: number }
  | { kind: 'effect'; op: string; args: string[]; line: number }
  | { kind: 'goto'; target: string; line: number }
  | { kind: 'end'; line: number };

export interface Script {
  title: string;
  portraits: { left?: { id: string; mood?: string }; right?: { id: string; mood?: string } };
  /** '' is the body; others are `@label` sections. */
  sections: Record<string, Line[]>;
}

export class DialogueSyntaxError extends Error {
  constructor(message: string, readonly line: number) {
    super(`line ${line}: ${message}`);
  }
}

export function parseDialogue(source: string): Script {
  const script: Script = { title: '', portraits: {}, sections: { '': [] } };
  let section = '';
  let pendingChoice: { options: { label: string; target: string; cond?: string }[]; line: number } | null = null;
  let lastSpeaker: string | null = null;

  const lines = source.split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const n = i + 1;
    const line = rawLine.replace(/\s+#.*$/, '').trimEnd();
    const text = line.trim();
    if (!text || text.startsWith('#')) return;

    // A choice block collects its "- label -> target" lines until something else appears.
    if (pendingChoice) {
      const m = /^-\s*(?:\[if\s+([^\]]+)\]\s*)?(.+?)\s*->\s*@?([a-zA-Z0-9_-]+)\s*$/.exec(text);
      if (m) {
        pendingChoice.options.push({ label: m[2]!.trim(), target: m[3]!, cond: m[1]?.trim() });
        return;
      }
      if (!pendingChoice.options.length) throw new DialogueSyntaxError('choice: needs at least one "- label -> target" line', pendingChoice.line);
      script.sections[section]!.push({ kind: 'choice', options: pendingChoice.options, line: pendingChoice.line });
      pendingChoice = null;
    }

    if (text.startsWith('title:')) {
      script.title = text.slice(6).trim();
      return;
    }
    const portrait = /^portrait\s+(left|right):\s*([a-z0-9-]+)(?:\s+mood=([a-z-]+))?\s*$/i.exec(text);
    if (portrait) {
      script.portraits[portrait[1]!.toLowerCase() as 'left' | 'right'] = { id: portrait[2]!, mood: portrait[3] };
      return;
    }
    if (text.startsWith('@')) {
      section = text.slice(1).trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(section)) throw new DialogueSyntaxError(`bad section name "${section}"`, n);
      script.sections[section] = [];
      lastSpeaker = null;
      return;
    }
    if (text === 'choice:') {
      pendingChoice = { options: [], line: n };
      return;
    }
    if (text.startsWith('>')) {
      const parts = text.slice(1).trim().split(/\s+/);
      const op = parts.shift() ?? '';
      if (op === 'end') script.sections[section]!.push({ kind: 'end', line: n });
      else if (op === 'goto') {
        if (!parts[0]) throw new DialogueSyntaxError('goto needs a section', n);
        script.sections[section]!.push({ kind: 'goto', target: parts[0].replace(/^@/, ''), line: n });
      } else script.sections[section]!.push({ kind: 'effect', op, args: parts, line: n });
      return;
    }
    const say = /^([a-zA-Z0-9-]+):\s+(.*)$/.exec(text);
    if (say) {
      lastSpeaker = say[1]!;
      script.sections[section]!.push({ kind: 'say', speaker: lastSpeaker, text: say[2]!, line: n });
      return;
    }
    // A bare line continues the previous speaker.
    script.sections[section]!.push({ kind: 'say', speaker: lastSpeaker, text, line: n });
  });
  if (pendingChoice) {
    const pc = pendingChoice as { options: { label: string; target: string; cond?: string }[]; line: number };
    if (!pc.options.length) throw new DialogueSyntaxError('choice: needs at least one option', pc.line);
    script.sections[section]!.push({ kind: 'choice', options: pc.options, line: pc.line });
  }
  for (const [name, lines] of Object.entries(script.sections)) {
    for (const l of lines) {
      if (l.kind === 'goto' && !(l.target in script.sections)) throw new DialogueSyntaxError(`goto @${l.target}: no such section`, l.line);
      if (l.kind === 'choice') for (const o of l.options) if (!(o.target in script.sections)) throw new DialogueSyntaxError(`choice "${o.label}" -> @${o.target}: no such section`, l.line);
    }
    void name;
  }
  return script;
}
