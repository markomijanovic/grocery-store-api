import { ObjectId } from 'mongodb';

export function createUserRepository(db) {
  const users = db.collection('users');

  return {
    findByEmail(email) {
      return users.findOne({ email });
    },

    findIdentityById(id) {
      return users.findOne(
        { _id: new ObjectId(id) },
        { projection: { passwordHash: 0 } },
      );
    },
  };
}