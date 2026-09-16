import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * The rule that matters is the architecture boundary at the bottom.
 * `src/engine/` and `src/content/` are pure: no renderer, no DOM, no
 * unseeded randomness. That is what lets the rules run headless in the
 * balance sim and in vitest. See docs/plans.md, "Layers and the boundary rule".
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.wrangler/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tools/**/*.ts'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },
  {
    // The architecture boundary.
    files: ['src/engine/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pixi.js', message: 'engine/ and content/ never import the renderer.' },
            { name: 'gsap', message: 'engine/ and content/ never import animation.' },
          ],
          patterns: [
            { group: ['**/ui/**', '**/app/**', '**/dev/**'], message: 'engine/ and content/ never import ui/, app/ or dev/.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage', 'sessionStorage', 'requestAnimationFrame', 'performance', 'navigator', 'fetch'].map(
          (name) => ({ name, message: `${name} is not available to engine/ or content/. Pass what you need in.` }),
        ),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use a named stream from engine/rng.ts.' },
        { object: 'Date', property: 'now', message: 'Pass time in; the engine must be deterministic.' },
      ],
    },
  },
);
