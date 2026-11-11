import { createUserRepository } from './users/users.repository.js';
import { createPasswordHasher } from './auth/passwords.js';
import { createTokenService } from './auth/tokens.js';
import { createAuthService } from './auth/auth.service.js';
import { createAuthenticate } from './auth/auth.middleware.js';
import { createApp } from './app.js';
import { createNodeRepository } from './nodes/nodes.repository.js';
import { createUserService } from './users/users.service.js';
import { accessPolicy } from './policies/access.policy.js';

export async function buildApplication({ db, config, logger }) {
  const userRepository = createUserRepository(db);
  const nodeRepository = createNodeRepository(db);
  const passwordHasher = createPasswordHasher();
  const tokenService = createTokenService(config);

  const authService = await createAuthService({
    userRepository,
    passwordHasher,
    tokenService,
    config,
  });

  const authenticate = createAuthenticate(authService);

  const userService = createUserService({
    userRepository,
    nodeRepository,
    accessPolicy,
    passwordHasher,
  });

  const app = createApp({
    authService,
    userService,
    authenticate,
    config,
    checkReadiness: () => db.command({ ping: 1 }),
    logger,
  });

  return { app, userRepository, nodeRepository, tokenService };
}
