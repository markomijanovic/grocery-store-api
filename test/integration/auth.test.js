import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createTestContext } from './helpers.js';
import { createApp } from '../../src/app.js';

let ctx;
before(async () => { ctx = await createTestContext(); });
after(async () => { await ctx?.close(); });
const login = email => request(ctx.app).post('/api/v1/auth/login').send({ email, password: ctx.password });

test('login normalizes email and returns a signed token and safe public profile', async () => {
  const response = await login(' MANAGER.NOVI-BEOGRAD@EXAMPLE.TEST ');
  assert.equal(response.status, 200);
  assert.equal(response.body.user.nodeId, 'novi-beograd');
  assert.equal(response.body.expiresIn, 900);
  assert.ok(!JSON.stringify(response.body).includes('passwordHash'));
  const me = await request(ctx.app).get('/api/v1/auth/me').auth(response.body.accessToken, { type: 'bearer' });
  assert.equal(me.status, 200);
  assert.equal(me.body.id, response.body.user.id);
  assert.ok(me.headers['x-request-id']);
  assert.equal(me.headers['x-powered-by'], undefined);
});

test('wrong passwords and unknown accounts return the same generic error', async () => {
  const badPassword = await request(ctx.app).post('/api/v1/auth/login')
    .send({ email: 'manager.novi-beograd@example.test', password: 'incorrect' });
  const unknown = await login('missing@example.test');
  assert.equal(badPassword.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(badPassword.body, unknown.body);
});

test('missing, malformed and tampered tokens are rejected', async () => {
  for (const header of ['', 'Basic abc', 'Bearer invalid', 'Bearer token extra']) {
    const response = await request(ctx.app).get('/api/v1/auth/me').set('Authorization', header);
    assert.equal(response.status, 401);
  }
  const { body } = await login('employee.novi-beograd@example.test');
  const parts = body.accessToken.split('.');
  parts[1] = Buffer.from('{"sub":"000000000000000000000001"}').toString('base64url');
  assert.equal((await request(ctx.app).get('/api/v1/auth/me').auth(parts.join('.'), { type: 'bearer' })).status, 401);
});

test('expired, incomplete, wrong-audience, wrong-issuer and wrong-algorithm tokens are rejected', async () => {
  const key = new TextEncoder().encode(ctx.config.jwtSecret);
  const user = await ctx.db.collection('users').findOne({ email: 'employee.novi-beograd@example.test' });
  const subject = user._id.toHexString();

  async function issue(scenario = {}) {
    let jwt = new SignJWT({})
      .setSubject(scenario.subject ?? subject)
      .setProtectedHeader({
        alg: scenario.algorithm ?? 'HS256',
        ...(scenario.noType ? {} : { typ: 'JWT' }),
      })
      .setIssuedAt()
      .setIssuer(scenario.issuer ?? ctx.config.jwtIssuer)
      .setAudience(scenario.audience ?? ctx.config.jwtAudience);

    if (!scenario.noExpiry) jwt = jwt.setExpirationTime(scenario.expiration ?? '15m');
    return jwt.sign(key);
  }

  const valid = await issue();
  await request(ctx.app).get('/api/v1/auth/me').auth(valid, { type: 'bearer' }).expect(200);

  const scenarios = [
    { expiration: '-1s' }, { issuer: 'other-service' }, { audience: 'other-client' },
    { algorithm: 'HS512' }, { noExpiry: true }, { subject: 'invalid-id' }, { noType: true },
  ];
  for (const scenario of scenarios) {
    const token = await issue(scenario);
    await request(ctx.app).get('/api/v1/auth/me').auth(token, { type: 'bearer' }).expect(401);
  }
});

test('authentication uses the current database identity and rejects deleted accounts', async () => {
  const { body } = await login('employee.bezanija@example.test');
  await ctx.db.collection('users').updateOne({ email: 'employee.bezanija@example.test' }, { $set: { nodeId: 'vracar' } });
  const me = await request(ctx.app).get('/api/v1/auth/me').auth(body.accessToken, { type: 'bearer' });
  assert.equal(me.body.nodeId, 'vracar');
  await ctx.db.collection('users').deleteOne({ email: 'employee.bezanija@example.test' });
  assert.equal((await request(ctx.app).get('/api/v1/auth/me').auth(body.accessToken, { type: 'bearer' })).status, 401);
});

test('JSON and login validation reject operators, extra fields and oversized payloads', async () => {
  assert.equal((await request(ctx.app).post('/api/v1/auth/login').send({ email: { $ne: null }, password: 'anything' })).status, 400);
  assert.equal((await request(ctx.app).post('/api/v1/auth/login').send({ email: 'a@example.test', password: 'anything', role: 'manager' })).status, 400);
  const malformed = await request(ctx.app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{');
  assert.equal(malformed.body.error.code, 'INVALID_JSON');
  assert.equal((await request(ctx.app).post('/api/v1/auth/login').send({ password: 'a'.repeat(20000) })).status, 413);
});

test('failed-login rate limiting returns JSON and Retry-After', async () => {
  const limited = await createTestContext({ loginLimit: 2 });
  try {
    for (let i = 0; i < 2; i++) await request(limited.app).post('/api/v1/auth/login').send({ email: 'none@example.test', password: 'wrong' }).expect(401);
    const result = await request(limited.app).post('/api/v1/auth/login').send({ email: 'none@example.test', password: 'wrong' });
    assert.equal(result.status, 429); assert.ok(result.headers['retry-after']);
    assert.equal(result.body.error.code, 'TOO_MANY_ATTEMPTS');
  } finally { await limited.close(); }
});

test('readiness failure does not fail liveness or disclose internals', async () => {
  const { app: unused, ...dependencies } = ctx;
  const app = createApp({ ...dependencies, config: ctx.config,
    authService: { login() {} }, authenticate(req,res,next) { next(); },
    checkReadiness() { throw new Error('private-database-credentials'); }, logger: { error() {} } });
  assert.equal((await request(app).get('/health')).status, 200);
  const ready = await request(app).get('/ready');
  assert.equal(ready.status, 503);
  assert.ok(!JSON.stringify(ready.body).includes('private-database-credentials'));
});

test('unexpected failures return generic errors and logs omit sensitive error messages', async () => {
  const logs = [];
  const app = createApp({ config: ctx.config,
    authService: { async login() { throw new Error('private-password-value'); } },
    authenticate(req,res,next) { next(); }, checkReadiness() {},
    logger: { error(entry) { logs.push(entry); } },
  });
  const response = await request(app).post('/api/v1/auth/login')
    .send({ email: 'someone@example.test', password: 'any-password' });
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify([response.body,logs]).includes('private-password-value'));
  assert.equal(logs[0].requestId, response.headers['x-request-id']);
});
