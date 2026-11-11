import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
export const nodeIdSchema = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const userParamsSchema = z.strictObject({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) });
export const nodeParamsSchema = z.strictObject({ nodeId: nodeIdSchema });
export const createUserSchema = z.strictObject({
  firstName: name, lastName: name,
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(12).max(128), nodeId: nodeIdSchema,
});
export const updateUserSchema = createUserSchema.omit({ password: true }).partial()
  .refine(value => Object.keys(value).length > 0, 'At least one editable field is required.');

const positiveInteger = (fallback, max) => z.string().regex(/^[1-9]\d*$/)
  .transform(Number).pipe(z.number().int().max(max)).prefault(String(fallback));
export const listQuerySchema = z.strictObject({
  includeDescendants: z.enum(['true','false']).transform(value => value === 'true').prefault('false'),
  page: positiveInteger(1, 10000), limit: positiveInteger(20, 100),
});
