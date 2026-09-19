import { z } from 'zod';

/**
 * Every word the game expects a player to understand, in one place
 * (docs/plans.md Phase 6.1). Text may hold `{TOKEN}`s that the engine fills
 * from its constants, so the words cannot drift from the rules.
 */
export const GlossaryKind = z.enum(['status', 'keyword', 'resource', 'term', 'intent', 'node']);
export type GlossaryKind = z.infer<typeof GlossaryKind>;

export const GlossaryEntry = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9-]+$/),
  kind: GlossaryKind,
  name: z.string().min(1),
  text: z.string().min(1),
  /** Ids worth showing alongside this one. */
  related: z.array(z.string()).optional(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntry>;
export const GlossarySet = z.array(GlossaryEntry);
