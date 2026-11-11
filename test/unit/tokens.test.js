import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { createTokenService } from '../../src/auth/tokens.js';

const config = {
  jwtSecret: randomBytes(32).toString('base64url'),
  jwtIssuer: 'grocery-store-api',
  jwtAudience: 'grocery-store-review',
  tokenTtlSeconds: 900,
};

const userId = '000000000000000000000001';

test('a valid token resolves to its user ID', async () => {
  const service = createTokenService(config);
  const token = await service.sign(userId);

  assert.equal(await service.verify(token), userId);
});

test('a token cannot be verified with another secret', async () => {
  const service = createTokenService(config);
  const token = await service.sign(userId);

  const otherService = createTokenService({
    ...config,
    jwtSecret: randomBytes(32).toString('base64url'),
  });

  await assert.rejects(otherService.verify(token));
});

test('unexpected issuer and audience are rejected', async () => {
  const service = createTokenService(config);
  const token = await service.sign(userId);

  const wrongIssuer = createTokenService({
    ...config,
    jwtIssuer: 'another-api',
  });

  const wrongAudience = createTokenService({
    ...config,
    jwtAudience: 'another-audience',
  });

  await assert.rejects(wrongIssuer.verify(token));
  await assert.rejects(wrongAudience.verify(token));
});

test('expired tokens are rejected', async () => {
  const expiredService = createTokenService({
    ...config,
    tokenTtlSeconds: -1,
  });

  const token = await expiredService.sign(userId);
  const service = createTokenService(config);

  await assert.rejects(service.verify(token));
});

test('invalid subjects and malformed tokens are rejected', async () => {
  const service = createTokenService(config);
  const token = await service.sign('invalid-user-id');

  await assert.rejects(service.verify(token));
  await assert.rejects(service.verify('invalid-token'));
});