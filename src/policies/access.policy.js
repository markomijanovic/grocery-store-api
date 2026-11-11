import { forbidden, notFound } from '../http/errors.js';

export const ROLES = Object.freeze(['employee', 'manager']);

function isActionAllowed(actor, action, targetRole) {
  if (!ROLES.includes(actor?.role) || !ROLES.includes(targetRole)) {
    return false;
  }

  if (action === 'read') {
    return actor.role === 'manager' || targetRole === 'employee';
  }

  if (action === 'manage') {
    return actor.role === 'manager';
  }

  return false;
}

export function isNodeInScope(actor, node) {
  if (typeof actor?.nodeId !== 'string' || !node) {
    return false;
  }

  return (
    actor.nodeId === node._id ||
    (
      Array.isArray(node.ancestors) &&
      node.ancestors.includes(actor.nodeId)
    )
  );
}

export function canRead(actor, targetRole, node) {
  return (
    isActionAllowed(actor, 'read', targetRole) &&
    isNodeInScope(actor, node)
  );
}

export function canManage(actor, node) {
  return (
    isActionAllowed(actor, 'manage', 'employee') &&
    isNodeInScope(actor, node)
  );
}

export const accessPolicy = Object.freeze({
  assertAction(actor, action, targetRole) {
    if (!isActionAllowed(actor, action, targetRole)) {
      throw forbidden();
    }
  },

  assertScope(actor, node) {
    if (!isNodeInScope(actor, node)) {
      throw notFound();
    }
  },
});
