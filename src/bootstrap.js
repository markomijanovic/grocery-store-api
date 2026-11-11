import { createUserRepository } from './users/users.repository.js';
import { createPasswordHasher } from './auth/passwords.js';
import { createTokenService } from './auth/tokens.js';
import { createAuthService } from './auth/auth.service.js';
import { createAuthenticate } from './auth/auth.middleware.js';
import { createApp } from './app.js';

export async function buildApplication({ db, config, logger }) {
  const userRepository = createUserRepository(db);
  const passwordHasher = createPasswordHasher();
  const tokenService = createTokenService(config);

  const authService = await createAuthService({
    userRepository,
    passwordHasher,
    tokenService,
    config,
  });

  const authenticate = createAuthenticate(authService);

  const app = createApp({
    authService,
    authenticate,
    config,
    checkReadiness: () => db.command({ ping: 1 }),
    logger,
  });

  return { app, userRepository, tokenService };
}
