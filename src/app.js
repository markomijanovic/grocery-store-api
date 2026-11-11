import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { createAuthRouter } from './auth/auth.routes.js';
import { AppError, notFound } from './http/errors.js';
import { errorHandler } from './http/middleware.js';

export function createApp({
  authService,
  authenticate,
  config,
  checkReadiness,
  logger = console,
}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(helmet());

  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set('X-Request-Id', req.id);
    next();
  });

  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', async (req, res) => {
    try {
      await checkReadiness();
    } catch {
      throw new AppError(503, 'NOT_READY', 'Service is not ready.');
    }

    res.json({ status: 'ready' });
  });

  app.use('/api/v1/auth', createAuthRouter({
    authService,
    authenticate,
    config,
  }));

  app.use((req, res, next) => next(notFound()));
  app.use(errorHandler(logger));

  return app;
}
