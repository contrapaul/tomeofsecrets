/**
 * The guide format: one Markdown file per chapter in `src/content/guide/`.
 * Deliberately small — headings, paragraphs, bullets, tables, `**bold**`,
 * `*italic*`, `[[term]]` and `{{directive}}` — because every chapter is written
 * by a teacher or a student, and a format you can hold in your head is worth
 * more here than one that can do anything.
 *
 * Parsing is pure and lives here so a test can read every shipped chapter
 * without a browser. Rendering is `ui/kit/markdown.ts`.
 */

export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** `[[Weak]]` — a glossary id the Explainer can describe. */
  term?: string;
}

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: Inline[] }
  | { kind: 'para'; text: Inline[] }
  | { kind: 'list'; items: Inline[][] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'directive'; name: string; arg?: string };

export interface Chapter {
  id: string;
  title: string;
  /** Groups chapters in the left column. */
  section: string;
  order: number;
  blocks: Block[];
}

/** Tables and lists the game fills in from content, so numbers never drift. */
export const DIRECTIVES = ['statuses', 'keywords', 'resources', 'nodes', 'boons', 'glossary', 'starter', 'card', 'relic'] as const;
export type DirectiveName = (typeof DIRECTIVES)[number];

export class GuideSyntaxError extends Error {
  constructor(message: string, readonly line: number) {
    super(`line ${line}: ${message}`);
  }
}

/** `**bold**`, `*italic*`, `[[term]]`; everything else is plain. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[\[([^\]]+)\]\]/g;
  let at = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > at) out.push({ text: src.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) out.push({ text: m[2], italic: true });
    else if (m[3] !== undefined) {
      // `[[Weak]]` prints Weak and explains `weak`; `[[Holy Power|holyPower]]` when they differ.
      const [label, id] = m[3].includes('|') ? m[3].split('|') : [m[3], m[3]];
      out.push({ text: label!.trim(), term: (id ?? label!).trim().replace(/\s+/g, '-').toLowerCase() });
    }
    at = m.index + m[0].length;
  }
  if (at < src.length) out.push({ text: src.slice(at) });
  return out.filter((i) => i.text !== '');
}

function frontMatter(lines: string[], id: string): { meta: Record<string, string>; start: number } {
  if (lines[0]?.trim() !== '---') throw new GuideSyntaxError(`${id}: needs a --- front matter block at the top`, 1);
  const meta: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === '---') return { meta, start: i + 1 };
    const at = line.indexOf(':');
    if (at < 0) throw new GuideSyntaxError(`${id}: front matter wants "key: value"`, i + 1);
    meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  throw new GuideSyntaxError(`${id}: front matter is never closed`, 1);
}

function tableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

export function parseGuide(source: string, id: string): Chapter {
  const lines = source.split(/\r?\n/);
  const { meta, start } = frontMatter(lines, id);
  for (const key of ['title', 'section'] as const) {
    if (!meta[key]) throw new GuideSyntaxError(`${id}: front matter needs ${key}`, 1);
  }
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flush = (): void => {
    if (para.length) {
      blocks.push({ kind: 'para', text: parseInline(para.join(' ')) });
      para = [];
    }
    if (list.length) {
      blocks.push({ kind: 'list', items: list.map(parseInline) });
      list = [];
    }
  };

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    const n = i + 1;

    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1]!.length as 1 | 2 | 3, text: parseInline(heading[2]!) });
      continue;
    }
    const directive = /^\{\{\s*([a-z-]+)(?::([a-z0-9-]+))?\s*\}\}$/.exec(line);
    if (directive) {
      flush();
      const name = directive[1]!;
      if (!(DIRECTIVES as readonly string[]).includes(name)) throw new GuideSyntaxError(`${id}: unknown directive {{${name}}}`, n);
      blocks.push({ kind: 'directive', name, ...(directive[2] ? { arg: directive[2] } : {}) });
      continue;
    }
    if (line.startsWith('|')) {
      flush();
      const head = tableRow(line);
      const rows: string[][] = [];
      let j = i + 1;
      // The |---|---| separator is optional noise; skip it if it is there.
      if (lines[j]?.trim().startsWith('|') && /^[|\s:-]+$/.test(lines[j]!)) j++;
      while (lines[j]?.trim().startsWith('|')) {
        rows.push(tableRow(lines[j]!.trim()));
        j++;
      }
      blocks.push({ kind: 'table', head, rows });
      i = j - 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (para.length) flush();
      list.push(line.replace(/^[-*]\s+/, ''));
      continue;
    }
    if (list.length) flush();
    para.push(line);
  }
  flush();

  return {
    id,
    title: meta.title!,
    section: meta.section!,
    order: Number(meta.order ?? 0) || 0,
    blocks,
  };
}

/** Every `[[term]]` a chapter uses, for the content test. */
export function termsOfChapter(chapter: Chapter): string[] {
  const out = new Set<string>();
  const walk = (inline: Inline[]): void => {
    for (const i of inline) if (i.term) out.add(i.term);
  };
  for (const b of chapter.blocks) {
    if (b.kind === 'heading' || b.kind === 'para') walk(b.text);
    else if (b.kind === 'list') for (const item of b.items) walk(item);
  }
  return [...out];
}
