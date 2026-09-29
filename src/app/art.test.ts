import { describe, expect, it } from 'vitest';
import { backgroundFor } from './art';

describe('artwork sets', () => {
  it('alpha swaps in the drawn background, development keeps the placeholder', () => {
    expect(backgroundFor('chapter1', 'alpha')).toBe('moss-halls');
    expect(backgroundFor('chapter1', 'development')).toBe('chapter1');
  });

  it('a chapter with no drawn art yet falls back to what was asked for', () => {
    for (const artwork of ['alpha', 'development'] as const) {
      expect(backgroundFor('chapter2', artwork)).toBe('chapter2');
      expect(backgroundFor('chapter3', artwork)).toBe('chapter3');
    }
  });
});
