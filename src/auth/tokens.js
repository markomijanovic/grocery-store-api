import { SignJWT, jwtVerify } from 'jose';

export function createTokenService(config) {
  const key = new TextEncoder().encode(config.jwtSecret);

  if (key.byteLength < 32) {
    throw new Error('JWT secret must contain at least 32 bytes.');
  }

  return {
    async sign(userId) {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(userId)
        .setIssuedAt()
        .setIssuer(config.jwtIssuer)
        .setAudience(config.jwtAudience)
        .setExpirationTime(`${config.tokenTtlSeconds}s`)
        .sign(key);
    },

    async verify(token) {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        typ: 'JWT',
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        requiredClaims: ['sub', 'iat', 'exp'],
      });

      if (
        typeof payload.sub !== 'string' ||
        !/^[a-fA-F0-9]{24}$/.test(payload.sub)
      ) {
        throw new Error('Invalid token subject.');
      }

      return payload.sub;
    },
  };
}