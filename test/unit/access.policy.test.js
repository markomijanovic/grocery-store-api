import test from 'node:test';
import assert from 'node:assert/strict';

import { organizationNodes } from '../../scripts/fixtures.js';
import {
  canRead,
  canManage,
} from '../../src/policies/access.policy.js';

const roles = ['employee', 'manager'];

const nodesById = new Map(
  organizationNodes.map(node => [node._id, node]),
);

function isDescendantOrSelf(actorNodeId, targetNodeId) {
  let currentId = targetNodeId;

  while (currentId !== null) {
    if (currentId === actorNodeId) {
      return true;
    }

    currentId = nodesById.get(currentId).parentId;
  }

  return false;
}

test('read permissions match all role and node combinations', () => {
  let checked = 0;

  for (const role of roles) {
    for (const actorNode of organizationNodes) {
      const actor = { role, nodeId: actorNode._id };

      for (const targetNode of organizationNodes) {
        for (const targetRole of roles) {
          const expected =
            isDescendantOrSelf(actorNode._id, targetNode._id) &&
            (role === 'manager' || targetRole === 'employee');

          assert.equal(
            canRead(actor, targetRole, targetNode),
            expected,
            `${role}@${actorNode._id} reading ${targetRole}@${targetNode._id}`,
          );

          checked += 1;
        }
      }
    }
  }

  assert.equal(checked, 2116);
});

test('management permissions match every role and node combination', () => {
  let checked = 0;

  for (const role of roles) {
    for (const actorNode of organizationNodes) {
      const actor = { role, nodeId: actorNode._id };

      for (const targetNode of organizationNodes) {
        const expected =
          role === 'manager' &&
          isDescendantOrSelf(actorNode._id, targetNode._id);

        assert.equal(
          canManage(actor, targetNode),
          expected,
          `${role}@${actorNode._id} managing users at ${targetNode._id}`,
        );

        checked += 1;
      }
    }
  }

  assert.equal(checked, 1058);
});

test('unknown roles and missing inputs are denied', () => {
  const target = nodesById.get('radnja-6');
  const manager = { role: 'manager', nodeId: 'novi-beograd' };
  const unknown = { role: 'admin', nodeId: 'srbija' };

  assert.equal(canRead(unknown, 'employee', target), false);
  assert.equal(canManage(unknown, target), false);
  assert.equal(canRead(manager, 'admin', target), false);
  assert.equal(canRead(undefined, 'employee', target), false);
  assert.equal(canManage(undefined, target), false);
  assert.equal(canRead(manager, 'employee', undefined), false);
  assert.equal(canManage(manager, undefined), false);
});