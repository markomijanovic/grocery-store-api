import { z } from 'zod';

const environmentSchema = z.object({
  PORT: z.string()
    .regex(/^\d+$/)
    .default('3000')
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),

  MONGODB_URI: z.string()
    .regex(/^mongodb(?:\+srv)?:\/\//),

  MONGODB_DB: z.string()
    .regex(/^[a-zA-Z0-9_-]+$/),

  JWT_SECRET: z.string().refine(
    value => Buffer.byteLength(value, 'utf8') >= 32,
    'JWT secret must contain at least 32 bytes.',
  ),

  JWT_ISSUER: z.string()
    .min(1)
    .default('grocery-store-api'),

  JWT_AUDIENCE: z.string()
    .min(1)
    .default('grocery-store-review'),
});

export function readConfig(env = process.env) {
  const result = environmentSchema.safeParse(env);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map(issue => issue.path[0])),
    ];

    throw new Error(
      `Invalid configuration: ${fields.join(', ')}. See .env.example.`,
    );
  }

  return Object.freeze({
    port: result.data.PORT,
    mongoUri: result.data.MONGODB_URI,
    dbName: result.data.MONGODB_DB,
    jwtSecret: result.data.JWT_SECRET,
    jwtIssuer: result.data.JWT_ISSUER,
    jwtAudience: result.data.JWT_AUDIENCE,
    tokenTtlSeconds: 900,
    loginLimit: 10,
    loginWindowMs: 15 * 60 * 1000,
  });
}