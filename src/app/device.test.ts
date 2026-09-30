import { describe, expect, it } from 'vitest';
import { layoutFor, layoutFromQuery } from './device';

describe('layoutFor', () => {
  it('gives a phone layout to a touch screen with a short side of a phone', () => {
    expect(layoutFor(852, 393, true)).toBe('phone'); // iPhone, landscape
    expect(layoutFor(393, 852, true)).toBe('phone'); // the same phone, portrait
    expect(layoutFor(932, 430, true)).toBe('phone'); // the largest iPhone, landscape
  });

  it('leaves tablets and desktops alone', () => {
    expect(layoutFor(1180, 820, true)).toBe('desktop'); // iPad, landscape
    expect(layoutFor(820, 1180, true)).toBe('desktop');
    expect(layoutFor(1440, 900, false)).toBe('desktop');
    // A small window on a desktop is still a desktop: the pointer decides.
    expect(layoutFor(600, 400, false)).toBe('desktop');
  });
});

describe('layoutFromQuery', () => {
  it('reads an explicit override and ignores anything else', () => {
    expect(layoutFromQuery('?layout=phone')).toBe('phone');
    expect(layoutFromQuery('?class=paladin&layout=desktop')).toBe('desktop');
    expect(layoutFromQuery('?layout=tablet')).toBeNull();
    expect(layoutFromQuery('')).toBeNull();
  });
});
