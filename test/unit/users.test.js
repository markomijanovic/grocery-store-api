import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createUserService } from '../../src/users/users.service.js';
import { accessPolicy } from '../../src/policies/access.policy.js';
import { createUserSchema, updateUserSchema, listQuerySchema } from '../../src/users/users.schemas.js';
import { toPublicUser } from '../../src/users/users.dto.js';
import { organizationNodes } from '../../scripts/fixtures.js';

function serviceFixture(nodeId, overrides = {}) {
  let writes = 0;
  const user = { _id: new ObjectId(), firstName: 'Test', lastName: 'Person', email: 'test@example.test',
    role: 'employee', nodeId, createdAt: new Date(), updatedAt: new Date() };
  const repository = {
    findById: async () => user,
    updateIfAtNode: async (original, changes) => { writes++; return { ...original, ...changes }; },
    deleteIfAtNode: async () => { writes++; return { deletedCount: 1 }; },
    ...overrides,
  };
  const service = createUserService({ userRepository: repository,
    nodeRepository: { findById: async id => organizationNodes.find(node => node._id === id) },
    accessPolicy, passwordHasher: { hash: async () => 'hash' } });
  return { service, user, get writes() { return writes; } };
}
const manager = { role: 'manager', nodeId: 'novi-beograd' };

test('moving within the managed subtree succeeds', async () => {
  const fixture = serviceFixture('bezanija');
  const result = await fixture.service.update(manager, 'employee', fixture.user._id.toHexString(), { nodeId: 'radnja-6' });
  assert.equal(result.nodeId, 'radnja-6'); assert.equal(fixture.writes, 1);
});

test('both directions of an unauthorized move are rejected without issuing a write', async () => {
  for (const [from,to] of [['bezanija','vracar'],['vracar','bezanija']]) {
    const fixture = serviceFixture(from);
    await assert.rejects(fixture.service.update(manager, 'employee', fixture.user._id.toHexString(), { nodeId: to }), { status: 404 });
    assert.equal(fixture.writes, 0);
  }
});

test('employees cannot update themselves; service guards work without HTTP middleware', async () => {
  const fixture = serviceFixture('novi-beograd');
  await assert.rejects(fixture.service.update({ role: 'employee', nodeId: 'novi-beograd' }, 'employee', fixture.user._id.toHexString(), { firstName: 'Changed' }), { status: 403 });
  assert.equal(fixture.writes, 0);
});

test('conditional update and delete conflicts do not report success', async () => {
  const fixture = serviceFixture('bezanija', {
    updateIfAtNode: async () => null, deleteIfAtNode: async () => ({ deletedCount: 0 }),
  });
  await assert.rejects(fixture.service.update(manager, 'employee', fixture.user._id.toHexString(), { firstName: 'Changed' }), { status: 409, code: 'RESOURCE_CHANGED' });
  await assert.rejects(fixture.service.delete(manager, 'employee', fixture.user._id.toHexString()), { status: 409 });
});

test('schemas normalize email but preserve passwords and reject protected fields', () => {
  const data = { firstName: ' Test ', lastName: 'Person', email: ' USER@EXAMPLE.TEST ', password: '  long-password  ', nodeId: 'bezanija' };
  const parsed = createUserSchema.parse(data);
  assert.equal(parsed.email, 'user@example.test'); assert.equal(parsed.password, data.password);
  for (const field of ['role','passwordHash','createdAt','updatedAt','id','_id','ancestors']) {
    assert.equal(createUserSchema.safeParse({ ...data, [field]: 'forbidden' }).success, false);
    assert.equal(updateUserSchema.safeParse({ firstName: 'Test', [field]: 'forbidden' }).success, false);
  }
  assert.equal(updateUserSchema.safeParse({}).success, false);
  assert.equal(updateUserSchema.safeParse({ password: 'a-long-password' }).success, false);
  assert.equal(createUserSchema.safeParse({ ...data, email: { $ne: null } }).success, false);
});

test('list flags and pagination are strict and deterministic', () => {
  assert.deepEqual(listQuerySchema.parse({}), { includeDescendants: false, page: 1, limit: 20 });
  assert.equal(listQuerySchema.parse({ includeDescendants: 'false' }).includeDescendants, false);
  for (const query of [{ includeDescendants: 'yes' },{ includeDescendants: ['true','false'] },
    { page: '0' },{ page: '1.5' },{ limit: '101' },{ anything: 'extra' }]) {
    assert.equal(listQuerySchema.safeParse(query).success, false);
  }
});

test('public serialization excludes all non-public fields, including future sensitive fields', () => {
  const fixture = serviceFixture('bezanija');
  const dto = toPublicUser({ ...fixture.user, passwordHash: 'secret', internalNotes: 'private' });
  assert.equal(dto.passwordHash, undefined); assert.equal(dto.internalNotes, undefined);
  assert.equal(Object.keys(dto).length, 8);
});
