import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../http/middleware.js';
import { toPublicUser } from '../users/users.dto.js';

const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(128),
});

export function createAuthRouter({ authService, authenticate, config }) {
  const router = Router();

  const limiter = rateLimit({
    windowMs: config.loginWindowMs,
    limit: config.loginLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) => res.status(429).json({
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many login attempts. Try again later.',
      },
    }),
  });

  router.post('/login', limiter, validate(loginSchema, 'body'), async (req, res) => {
    res.json(await authService.login(req.validated.body));
  });

  router.get('/me', authenticate, (req, res) => {
    res.json(toPublicUser(req.user));
  });

  return router;
}
