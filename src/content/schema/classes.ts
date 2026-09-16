import { z } from 'zod';
import { ClassId, ResourceName } from './index';

export const ClassDef = z.strictObject({
  id: ClassId,
  name: z.string(),
  title: z.string(),
  hp: z.int().min(1),
  /** The resource widget to show, if any. */
  resource: ResourceName.optional(),
  /** The default companion; only the Tracker has one. */
  companion: z.enum(['wolf', 'bear', 'hawk', 'serpent', 'boar']).optional(),
  starter: z.array(z.string()).min(1),
  blurb: z.string(),
});
export type ClassDef = z.infer<typeof ClassDef>;
export const ClassSet = z.array(ClassDef);
