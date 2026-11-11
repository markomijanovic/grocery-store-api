import { AppError, notFound } from '../http/errors.js';
import { toPublicUser } from './users.dto.js';

export function createUserService({ userRepository, nodeRepository, accessPolicy, passwordHasher }) {
  async function authorizedNode(actor, nodeId) {
    const node = await nodeRepository.findById(nodeId);
    accessPolicy.assertScope(actor, node);
    return node;
  }
  async function authorizedUser(actor, role, id, action) {
    accessPolicy.assertAction(actor, action, role);
    const user = await userRepository.findById(id, role);
    if (!user) throw notFound();
    await authorizedNode(actor, user.nodeId);
    return user;
  }
  const resourceChanged = () => new AppError(409, 'RESOURCE_CHANGED', 'Resource changed. Read it again before retrying.');
  return {
    async get(actor, role, id) {
      return toPublicUser(await authorizedUser(actor, role, id, 'read'));
    },
    async create(actor, role, input) {
      accessPolicy.assertAction(actor, 'manage', role);
      await authorizedNode(actor, input.nodeId);
      const now = new Date();
      const user = await userRepository.create({
        firstName: input.firstName, lastName: input.lastName, email: input.email,
        nodeId: input.nodeId, role, passwordHash: await passwordHasher.hash(input.password),
        createdAt: now, updatedAt: now,
      });
      return toPublicUser(user);
    },
    async update(actor, role, id, input) {
      const current = await authorizedUser(actor, role, id, 'manage');
      if (input.nodeId !== undefined) await authorizedNode(actor, input.nodeId);
      const changes = Object.fromEntries(Object.entries(input)
        .filter(([field]) => ['firstName','lastName','email','nodeId'].includes(field)));
      const updated = await userRepository.updateIfAtNode(current, { ...changes, updatedAt: new Date() });
      if (!updated) throw resourceChanged();
      return toPublicUser(updated);
    },
    async delete(actor, role, id) {
      const current = await authorizedUser(actor, role, id, 'manage');
      const result = await userRepository.deleteIfAtNode(current);
      if (result.deletedCount !== 1) throw resourceChanged();
    },
    async list(actor, role, nodeId, { includeDescendants, page, limit }) {
      accessPolicy.assertAction(actor, 'read', role);
      await authorizedNode(actor, nodeId);
      const nodeIds = [nodeId];
      if (includeDescendants) nodeIds.push(...await nodeRepository.findDescendantIds(nodeId));
      const users = await userRepository.listByNodes({ role, nodeIds, page, limit });
      return { data: users.slice(0, limit).map(toPublicUser),
        meta: { page, limit, hasNext: users.length > limit } };
    },
  };
}
