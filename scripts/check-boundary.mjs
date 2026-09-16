/**
 * Proves the architecture boundary actually fails, not merely that it exists.
 *
 * Writes a deliberately violating file into src/engine/, lints it, checks the
 * expected errors came back, and deletes it again. A lint rule nobody has seen
 * fail is a lint rule nobody can trust. Then lints the real directories.
 */
import { execFile } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);

const GUARDED = ['src/engine/__boundary_check__.ts', 'src/content/__boundary_check__.ts'];

const VIOLATION = `// Written by scripts/check-boundary.mjs. Deleted immediately afterwards.
import { Container } from 'pixi.js';

export function bad(): number {
  const el = document.querySelector('canvas');
  return Math.random() + (el ? 1 : 0) + new Container().children.length;
}
`;

const EXPECTED = ['no-restricted-imports', 'no-restricted-globals', 'no-restricted-properties'];

async function lint(files) {
  try {
    const { stdout } = await run('npx', ['eslint', '--format', 'json', '--no-error-on-unmatched-pattern', ...files]);
    return JSON.parse(stdout);
  } catch (error) {
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

let failed = false;

for (const file of GUARDED) {
  mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  writeFileSync(file, VIOLATION);
  try {
    const [result] = await lint([file]);
    const rules = new Set((result?.messages ?? []).map((m) => m.ruleId));
    for (const rule of EXPECTED) {
      if (!rules.has(rule)) {
        console.error(`boundary: ${file} did NOT trigger ${rule}`);
        failed = true;
      }
    }
  } finally {
    rmSync(file, { force: true });
  }
}

if (failed) {
  console.error('boundary: the lint rules are not guarding engine/ and content/. Fix eslint.config.js.');
  process.exit(1);
}

const real = await lint(['src/engine', 'src/content']);
const problems = real.flatMap((r) => r.messages.map((m) => `${r.filePath}:${m.line} ${m.ruleId} ${m.message}`));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('boundary: engine/ and content/ are clean, and the guard is proven to fire.');
