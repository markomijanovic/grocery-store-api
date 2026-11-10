import { pathToFileURL } from 'node:url';
import { readConfig } from '../src/config.js';
import { connectDatabase, ensureIndexes } from '../src/db.js';
import { organizationNodes,demoUsers } from './fixtures.js';
import { createPasswordHasher } from '../src/auth/passwords.js';
import { email } from 'zod';

export async function seedOrganization(db) {
  await ensureIndexes(db);

  const nodes = db.collection('nodes');

  const result = await nodes.bulkWrite(
    organizationNodes.map(node => ({
      updateOne: {
        filter: { _id: node._id },
        update: {
          $setOnInsert: node,
        },
        upsert: true,
      },
    })),
  );

  const storedNodes = await nodes.find({
    _id: { $in: organizationNodes.map(node => node._id) },
  }).toArray();

  const storedById = new Map(
    storedNodes.map(node => [node._id, node]),
  );

  for (const expected of organizationNodes) {
    const actual = storedById.get(expected._id);

    if (
      !actual ||
      actual.name !== expected.name ||
      actual.parentId !== expected.parentId ||
      actual.type !== expected.type ||
      JSON.stringify(actual.ancestors) !==
        JSON.stringify(expected.ancestors)
    ) {
      throw new Error(
        `Existing organization data conflicts with seed: ${expected._id}`,
      );
    }
  }

  return {
    nodes: storedNodes.length,
    insertedNodes: result.upsertedCount,
  };
}

export async function seedDatabase(db,password,passwordHasher = createPasswordHasher()) {
  if(
    typeof password !=='string' ||
    password.length <12 ||
    password.length >128
  ){
    throw new Error('SEED_PASSWORD must contain 12-128 characters.');
  }

  const organizationResult = await seedOrganization(db);

  const users = db.collection('users');
  const usersToSeed = demoUsers();

  let insertedUsers = 0;

  for(const user of usersToSeed){
    const existing = await users.findOne(
      {email: user.email},
      {projection: {_id: 1}},
    );

    if (existing){
      continue;
    }

    const now = new Date();
    const passwordHash = await passwordHasher.hash(password);

    const result = await users.updateOne(
      {email: user.email},
      {
        $setOnInsert:{
          ...user,
          passwordHash,
          createdAt: now,
          updatedAt: now,
        }
      },
      {upsert: true},
    );

    insertedUsers+= result.upsertedCount;
  }

  return{
    ...organizationResult,
    demoUsers: usersToSeed.length,
    insertedUsers,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href // Check whether this module is executed directly.
) {
  let client;

  try {
    const connection = await connectDatabase(readConfig());
    client = connection.client;

    const result = await seedDatabase(
      connection.db,
      process.env.SEED_PASSWORD,
    );

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client?.close();
  }
}