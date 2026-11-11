import { unauthenticated } from '../http/errors.js';

export function createAuthenticate(authService) {
  return async (req, res, next) => {
    const authorization = req.get('authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);

    if (!match) {
      throw unauthenticated();
    }

    req.user = await authService.resolveActor(match[1]);
    next();
  };
}
