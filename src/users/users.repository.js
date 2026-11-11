import { ObjectId } from 'mongodb';

export function createUserRepository(db) {
  const users = db.collection('users');
  const publicProjection = { passwordHash: 0 };
  return {
    findByEmail: email => users.findOne({ email }),
    findIdentityById: id => users.findOne({ _id: new ObjectId(id) }, { projection: publicProjection }),
    findById: (id, role) => users.findOne({ _id: new ObjectId(id), role }, { projection: publicProjection }),
    async create(document) {
      const { insertedId } = await users.insertOne(document);
      return { ...document, _id: insertedId };
    },
    listByNodes: ({ role, nodeIds, page, limit }) => users
      .find({ role, nodeId: { $in: nodeIds } }, { projection: publicProjection })
      .sort({ _id: 1 }).skip((page - 1) * limit).limit(limit + 1).toArray(),
    updateIfAtNode: (user, changes) => users.findOneAndUpdate(
      { _id: user._id, role: user.role, nodeId: user.nodeId },
      { $set: changes }, { returnDocument: 'after', projection: publicProjection, includeResultMetadata: false },
    ),
    deleteIfAtNode: user => users.deleteOne({ _id: user._id, role: user.role, nodeId: user.nodeId }),
  };
}
