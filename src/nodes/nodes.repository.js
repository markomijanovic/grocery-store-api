export function createNodeRepository(db) {
  const nodes = db.collection('nodes');
  return {
    findById: id => nodes.findOne({ _id: id }),
    async findDescendantIds(id) {
      const descendants = await nodes.find({ ancestors: id }, { projection: { _id: 1 } }).toArray();
      return descendants.map(node => node._id);
    },
  };
}
