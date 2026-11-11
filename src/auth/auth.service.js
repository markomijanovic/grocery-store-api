import { randomBytes } from 'node:crypto';

import { AppError, unauthenticated } from '../http/errors.js';
import { ROLES } from '../policies/access.policy.js';
import { toPublicUser } from '../users/users.dto.js';

export async function createAuthService({
  userRepository,
  passwordHasher,
  tokenService,
  config,
}) {
  const dummyHash = await passwordHasher.hash(
    randomBytes(32).toString('base64url'),
  );

  return {
    async login({ email, password }) {
      const user = await userRepository.findByEmail(email);

      const valid = await passwordHasher.verify(
        user?.passwordHash ?? dummyHash,
        password,
      );

      if (!user || !valid || !ROLES.includes(user.role)) {
        throw new AppError(
          401,
          'INVALID_CREDENTIALS',
          'Invalid email or password.',
        );
      }

      return {
        accessToken: await tokenService.sign(
          user._id.toHexString(),
        ),
        tokenType: 'Bearer',
        expiresIn: config.tokenTtlSeconds,
        user: toPublicUser(user),
      };
    },

    async resolveActor(token) {
      let id;

      try {
        id = await tokenService.verify(token);
      } catch {
        throw unauthenticated();
      }

      const user = await userRepository.findIdentityById(id);

      if (!user || !ROLES.includes(user.role)) {
        throw unauthenticated();
      }

      return user;
    },
  };
}