import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const baseUrl = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
async function call(method, path, { token, body, status = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status, `${method} ${path}: unexpected HTTP status`);
  console.log(`${response.status} ${method} ${path}`);
  return response.status === 204 ? undefined : response.json();
}

try {
  await call('GET', '/health'); await call('GET', '/ready');
  const logIn = role => call('POST', '/api/v1/auth/login', { body: {
    email: `${role}.novi-beograd@example.test`, password: process.env.SEED_PASSWORD,
  } });
  const manager = await logIn('manager'); const employee = await logIn('employee');
  const token = manager.accessToken;
  await call('GET', '/api/v1/auth/me', { token });
  const direct = await call('GET', '/api/v1/nodes/novi-beograd/employees', { token });
  assert.ok(direct.data.every(user => user.nodeId === 'novi-beograd'));
  const subtree = await call('GET', '/api/v1/nodes/novi-beograd/employees?includeDescendants=true&limit=100', { token });
  assert.deepEqual([...new Set(subtree.data.map(user => user.nodeId))].sort(), ['bezanija','novi-beograd','radnja-6']);
  await call('GET', '/api/v1/nodes/vracar/employees', { token, status: 404 });
  await call('GET', '/api/v1/nodes/novi-beograd/managers', { token: employee.accessToken, status: 403 });
  for (const path of ['employees','managers']) {
    let created;
    try {
      created = await call('POST', `/api/v1/${path}`, { token, status: 201, body: {
        firstName: 'Demo', lastName: 'Workflow', nodeId: 'bezanija',
        email: `demo.${randomBytes(8).toString('hex')}@example.test`, password: process.env.SEED_PASSWORD,
      } });
      await call('GET', `/api/v1/${path}/${created.id}`, { token });
      const moved = await call('PATCH', `/api/v1/${path}/${created.id}`, { token, body: { nodeId: 'radnja-6' } });
      assert.equal(moved.nodeId, 'radnja-6');
      await call('PATCH', `/api/v1/${path}/${created.id}`, { token, body: { nodeId: 'vracar' }, status: 404 });
    } finally {
      if (created) await call('DELETE', `/api/v1/${path}/${created.id}`, { token, status: 204 });
    }
  }
  console.log('Demo passed. Temporary demo accounts were removed.');
} catch (error) {
  console.error(`Demo failed: ${error.message}`);
  process.exitCode = 1;
}
