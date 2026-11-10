import { pathToFileURL } from 'node:url';
import { readConfig } from '../src/config.js';
import { connectDatabase, ensureIndexes } from '../src/db.js';
import { organizationNodes } from './fixtures.js';

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

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href // Check whether this module is executed directly.
) {
  let client;

  try {
    const connection = await connectDatabase(readConfig());
    client = connection.client;

    const result = await seedOrganization(connection.db);

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client?.close();
  }
}