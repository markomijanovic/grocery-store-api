import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createTestContext } from './helpers.js';
import { seedDatabase } from '../../scripts/seed.js';

let ctx, managerToken, employeeToken, rootToken;
const credentials = email => ({ email, password: ctx.password });
const as = (method, path, token = managerToken) => request(ctx.app)[method](`/api/v1${path}`).auth(token, { type: 'bearer' });
const newUser = (email, nodeId = 'bezanija') => ({ firstName: 'Test', lastName: 'Reviewer', email, nodeId, password: ctx.password });
const fixture = email => ctx.db.collection('users').findOne({ email });
async function login(email) {
  const response = await request(ctx.app).post('/api/v1/auth/login').send(credentials(email)).expect(200);
  return response.body.accessToken;
}
function safeUser(user) {
  assert.deepEqual(Object.keys(user).sort(), ['id','firstName','lastName','email','role','nodeId','createdAt','updatedAt'].sort());
}

before(async () => {
  ctx = await createTestContext();
  managerToken = await login('manager.novi-beograd@example.test');
  employeeToken = await login('employee.novi-beograd@example.test');
  rootToken = await login('manager.srbija@example.test');
});
after(async () => { await ctx?.close(); });

test('all four list modes enforce the role and requested organizational scope', async () => {
  for (const path of ['employees','managers']) {
    const direct = await as('get', `/nodes/novi-beograd/${path}?includeDescendants=false&limit=100`).expect(200);
    const recursive = await as('get', `/nodes/novi-beograd/${path}?includeDescendants=true&limit=100`).expect(200);
    assert.equal(direct.body.data.length, 1);
    assert.equal(direct.body.data[0].nodeId, 'novi-beograd');
    assert.equal(recursive.body.data.length, 3);
    assert.deepEqual(recursive.body.data.map(user => user.nodeId).sort(), ['bezanija','novi-beograd','radnja-6']);
    recursive.body.data.forEach(safeUser);
    const leaf = await as('get', `/nodes/radnja-6/${path}?includeDescendants=true`).expect(200);
    assert.equal(leaf.body.data.length, 1);
    assert.deepEqual((await as('get', `/nodes/novi-beograd/${path}`).expect(200)).body.data, direct.body.data);
  }
});

test('employees can read employees in their subtree but cannot read managers', async () => {
  const list = await as('get', '/nodes/novi-beograd/employees?includeDescendants=true', employeeToken).expect(200);
  assert.equal(list.body.data.length, 3);
  const child = await fixture('employee.radnja-6@example.test');
  await as('get', `/employees/${child._id}`, employeeToken).expect(200);
  await as('get', '/nodes/novi-beograd/managers', employeeToken).expect(403);
  await as('get', '/managers/ffffffffffffffffffffffff', employeeToken).expect(403);
});

test('ancestors, sibling branches and unknown nodes return the same hidden-resource response', async () => {
  const missing = await as('get', '/nodes/missing-node/employees').expect(404);
  for (const node of ['srbija','grad-beograd','vracar','novi-sad']) {
    for (const path of ['employees','managers']) {
      const response = await as('get', `/nodes/${node}/${path}?includeDescendants=true`).expect(404);
      assert.deepEqual(response.body, missing.body);
    }
  }
});

test('root access reaches both branches and all seed users', async () => {
  for (const path of ['employees','managers']) {
    const all = await as('get', `/nodes/srbija/${path}?includeDescendants=true&limit=100`, rootToken).expect(200);
    assert.equal(all.body.data.length, 23);
  }
});

for (const [path, role] of [['employees','employee'],['managers','manager']]) {
  test(`${role} completes create/read/update/move/delete, including same-node manager peers`, async () => {
    const created = await as('post', `/${path}`).send(newUser(`${role}.crud@example.test`, 'novi-beograd')).expect(201);
    safeUser(created.body); assert.equal(created.body.role, role);
    assert.equal(created.headers.location, `/api/v1/${path}/${created.body.id}`);
    const id = created.body.id;
    const stored = await fixture(`${role}.crud@example.test`);
    assert.ok(stored.passwordHash.startsWith('$argon2id$'));
    assert.notEqual(stored.passwordHash, ctx.password);
    assert.equal((await as('get', `/${path}/${id}`).expect(200)).body.id, id);
    const updated = await as('patch', `/${path}/${id}`).send({ firstName: 'Updated', nodeId: 'bezanija' }).expect(200);
    safeUser(updated.body); assert.equal(updated.body.firstName, 'Updated');
    const moved = await as('patch', `/${path}/${id}`).send({ nodeId: 'radnja-6' }).expect(200);
    assert.equal(moved.body.nodeId, 'radnja-6');
    const deleted = await as('delete', `/${path}/${id}`).expect(204);
    assert.equal(deleted.text, '');
    await as('get', `/${path}/${id}`).expect(404);
  });

  test(`employee cannot create, update or delete a ${role}`, async () => {
    const target = await fixture(`${role}.novi-beograd@example.test`);
    await as('post', `/${path}`, employeeToken).send(newUser(`denied.${role}@example.test`)).expect(403);
    await as('patch', `/${path}/${target._id}`, employeeToken).send({ firstName: 'Forbidden' }).expect(403);
    await as('delete', `/${path}/${target._id}`, employeeToken).expect(403);
    assert.equal((await fixture(target.email)).firstName, target.firstName);
  });

  test(`out-of-scope ${role} cannot be created, read, updated, deleted or brought into scope`, async () => {
    const target = await fixture(`${role}.vracar@example.test`);
    await as('post', `/${path}`).send(newUser(`outside.${role}@example.test`, 'vracar')).expect(404);
    await as('get', `/${path}/${target._id}`).expect(404);
    await as('patch', `/${path}/${target._id}`).send({ nodeId: 'bezanija' }).expect(404);
    await as('delete', `/${path}/${target._id}`).expect(404);
    assert.equal((await fixture(target.email)).nodeId, 'vracar');
    const inScope = await fixture(`${role}.bezanija@example.test`);
    await as('patch', `/${path}/${inScope._id}`).send({ nodeId: 'vracar' }).expect(404);
    assert.equal((await fixture(inScope.email)).nodeId, 'bezanija');
  });
}

test('cross-role resource IDs cannot bypass the entity boundary', async () => {
  const manager = await fixture('manager.bezanija@example.test');
  const employee = await fixture('employee.bezanija@example.test');
  for (const [path,user] of [['employees',manager],['managers',employee]]) {
    await as('get', `/${path}/${user._id}`).expect(404);
    await as('patch', `/${path}/${user._id}`).send({ firstName: 'Wrong route' }).expect(404);
    await as('delete', `/${path}/${user._id}`).expect(404);
  }
});

test('global normalized email uniqueness is enforced across roles and concurrent requests', async () => {
  const body = newUser(' RACE@EXAMPLE.TEST ');
  const responses = await Promise.all([
    as('post', '/employees').send(body), as('post', '/managers').send(body),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201,409]);
  assert.equal(responses.find(response => response.status === 409).body.error.code, 'EMAIL_CONFLICT');
  assert.equal(await ctx.db.collection('users').countDocuments({ email: 'race@example.test' }), 1);
  const winner = responses.find(response => response.status === 201).body;
  await as('delete', `/${winner.role === 'employee' ? 'employees' : 'managers'}/${winner.id}`).expect(204);
  const employee = await fixture('employee.bezanija@example.test');
  await as('patch', `/employees/${employee._id}`).send({ email: 'MANAGER.BEZANIJA@EXAMPLE.TEST' }).expect(409);
  assert.equal((await fixture(employee.email)).email, employee.email);
});

test('protected fields, malformed IDs and Mongo query operators are rejected', async () => {
  const employee = await fixture('employee.bezanija@example.test');
  for (const field of ['role','passwordHash','_id','id','createdAt','updatedAt','ancestors']) {
    await as('post', '/employees').send({ ...newUser('invalid@example.test'), [field]: 'forbidden' }).expect(400);
    await as('patch', `/employees/${employee._id}`).send({ firstName: 'Changed', [field]: 'forbidden' }).expect(400);
  }
  await as('patch', `/employees/${employee._id}`).send({}).expect(400);
  await as('patch', `/employees/${employee._id}`).send({ password: 'new-password-123' }).expect(400);
  await as('post', '/employees').send({ ...newUser('invalid@example.test'), email: { $ne: null } }).expect(400);
  await as('get', '/employees/not-an-object-id').expect(400);
  await as('get', '/employees/ffffffffffffffffffffffff').expect(404);
  await as('post', '/employees').send(newUser('missing@example.test', 'missing-node')).expect(404);
});

test('pagination is stable and complete; invalid or repeated query arguments are rejected', async () => {
  const ids = [];
  for (let page = 1; page <= 3; page++) {
    const response = await as('get', `/nodes/novi-beograd/employees?includeDescendants=true&limit=1&page=${page}`).expect(200);
    ids.push(response.body.data[0].id);
    assert.equal(response.body.meta.hasNext, page < 3);
  }
  assert.equal(new Set(ids).size, 3); assert.deepEqual(ids, [...ids].sort());
  const empty = await as('get', '/nodes/novi-beograd/employees?includeDescendants=true&limit=1&page=4').expect(200);
  assert.deepEqual(empty.body.data, []); assert.equal(empty.body.meta.hasNext, false);
  for (const query of ['includeDescendants=no','includeDescendants=true&includeDescendants=false',
    'limit=101','page=0','page=10001','page=-1','limit[]=1','$where=anything']) {
    await as('get', `/nodes/novi-beograd/employees?${query}`).expect(400);
  }
});

test('changed actor assignment takes effect on the next request with the same JWT', async () => {
  const created = await as('post', '/managers').send(newUser('moving.actor@example.test', 'novi-beograd')).expect(201);
  const token = await login(created.body.email);
  await as('patch', `/managers/${created.body.id}`, rootToken).send({ nodeId: 'vracar' }).expect(200);
  await as('get', '/nodes/novi-beograd/employees', token).expect(404);
  await as('get', '/nodes/vracar/employees', token).expect(200);
  await ctx.db.collection('users').updateOne({ email: created.body.email }, { $set: { role: 'employee' } });
  await as('get', '/nodes/vracar/managers', token).expect(403);
  await ctx.db.collection('users').deleteOne({ email: created.body.email });
});

test('manager self-deletion is allowed and invalidates subsequent authenticated requests', async () => {
  const created = await as('post', '/managers').send(newUser('self.delete@example.test', 'novi-beograd')).expect(201);
  const token = await login(created.body.email);
  await as('delete', `/managers/${created.body.id}`, token).expect(204);
  await request(ctx.app).get('/api/v1/auth/me').auth(token, { type: 'bearer' }).expect(401);
});

test('all business routes require authentication', async () => {
  for (const [method,path] of [['get','/employees/ffffffffffffffffffffffff'],['post','/employees'],
    ['patch','/managers/ffffffffffffffffffffffff'],['delete','/employees/ffffffffffffffffffffffff'],
    ['get','/nodes/novi-beograd/employees'],['get','/nodes/novi-beograd/managers']]) {
    await request(ctx.app)[method](`/api/v1${path}`).expect(401);
  }
});

test('repeated seed preserves existing profiles, passwords and fixture counts', async () => {
  const employee = await fixture('employee.novi-beograd@example.test');
  await ctx.db.collection('users').updateOne({ _id: employee._id }, { $set: { firstName: 'Preserved' } });
  const result = await seedDatabase(ctx.db, ctx.password);
  assert.equal(result.insertedUsers, 0);
  assert.equal(await ctx.db.collection('nodes').countDocuments(), 23);
  assert.equal(await ctx.db.collection('users').countDocuments(), 46);
  const after = await fixture(employee.email);
  assert.equal(after.firstName, 'Preserved'); assert.equal(after.passwordHash, employee.passwordHash);
});

test('seed refuses conflicting stored organization paths', async () => {
  const original = await ctx.db.collection('nodes').findOne({ _id: 'bezanija' });
  try {
    await ctx.db.collection('nodes').updateOne({ _id: original._id }, { $set: { ancestors: ['vracar'] } });
    await assert.rejects(seedDatabase(ctx.db, ctx.password), /organization data conflicts/);
  } finally {
    await ctx.db.collection('nodes').updateOne({ _id: original._id }, { $set: { ancestors: original.ancestors } });
  }
});
