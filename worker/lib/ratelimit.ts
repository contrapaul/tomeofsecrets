import { fail } from './http';
import type { Store } from './store';

/** Fixed-window limiter on the rate_limits table; 429 past `max` hits in `windowMs`. Ported from flashstone. */
export async function rateLimit(store: Store, key: string, max: number, windowMs: number, now = Date.now()): Promise<void> {
  const count = await store.bumpRateLimit(key, now, now + windowMs);
  if (count > max) fail(429, 'Too many attempts. Please wait a while and try again.');
}
