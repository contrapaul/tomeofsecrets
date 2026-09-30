import { describe, expect, it } from 'vitest';
import { backgroundFor } from './art';

describe('artwork sets', () => {
  it('illustrated swaps in the drawn background, alpha keeps the generated one', () => {
    expect(backgroundFor('chapter1', 'illustrated')).toBe('moss-halls');
    expect(backgroundFor('chapter1', 'placeholder')).toBe('chapter1');
  });

  it('every chapter uses the drawn art for now; the alpha set keeps its own key', () => {
    for (const chapter of ['chapter1', 'chapter2', 'chapter3']) {
      expect(backgroundFor(chapter, 'illustrated')).toBe('moss-halls');
      expect(backgroundFor(chapter, 'placeholder')).toBe(chapter);
    }
  });

  it('a key that is not a chapter is left alone, so the dev page can ask for one directly', () => {
    expect(backgroundFor('moss-halls', 'illustrated')).toBe('moss-halls');
    expect(backgroundFor('moss-halls', 'placeholder')).toBe('moss-halls');
  });
});
