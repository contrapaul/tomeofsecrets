import { describe, expect, it } from 'vitest';
import { backgroundFor } from './art';

describe('artwork sets', () => {
  it('alpha swaps in the drawn background, development keeps the placeholder', () => {
    expect(backgroundFor('chapter1', 'alpha')).toBe('moss-halls');
    expect(backgroundFor('chapter1', 'development')).toBe('chapter1');
  });

  it('every chapter uses the drawn art for now; dev art keeps its own key', () => {
    for (const chapter of ['chapter1', 'chapter2', 'chapter3']) {
      expect(backgroundFor(chapter, 'alpha')).toBe('moss-halls');
      expect(backgroundFor(chapter, 'development')).toBe(chapter);
    }
  });

  it('a key that is not a chapter is left alone, so the dev page can ask for one directly', () => {
    expect(backgroundFor('moss-halls', 'alpha')).toBe('moss-halls');
    expect(backgroundFor('moss-halls', 'development')).toBe('moss-halls');
  });
});
