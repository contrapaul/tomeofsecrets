import { describe, expect, it } from 'vitest';
import { parseHash, toHash } from './router';

describe('parseHash', () => {
  it('maps empty and root hashes to /', () => {
    expect(parseHash('').path).toBe('/');
    expect(parseHash('#').path).toBe('/');
    expect(parseHash('#/').path).toBe('/');
  });

  it('splits path and query', () => {
    const r = parseHash('#/dev/fight?class=mage&enemies=a,b');
    expect(r.path).toBe('/dev/fight');
    expect(r.params.get('class')).toBe('mage');
    expect(r.params.get('enemies')).toBe('a,b');
  });

  it('tolerates a missing leading slash and trailing slashes', () => {
    expect(parseHash('#dev/stats').path).toBe('/dev/stats');
    expect(parseHash('#/tome/').path).toBe('/tome');
  });

  it('round-trips through toHash', () => {
    const h = toHash('/dev/fight', { seed: 'abc', class: 'paladin' });
    const r = parseHash(h);
    expect(r.path).toBe('/dev/fight');
    expect(r.params.get('seed')).toBe('abc');
    expect(toHash('/')).toBe('#/');
  });
});
