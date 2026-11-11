import { randomBytes } from 'node:crypto';
import { readConfig } from '../../src/config.js';
import { connectDatabase } from '../../src/db.js';
import { seedDatabase } from '../../scripts/seed.js';
import { buildApplication } from '../../src/bootstrap.js';

export async function createTestContext(overrides = {}) {
  const databaseName = `grocery_test_${process.pid}_${randomBytes(6).toString('hex')}`;
  const config = {
    ...readConfig({
      MONGODB_URI: process.env.TEST_MONGODB_URI ?? process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27018',
      MONGODB_DB: databaseName,
      JWT_SECRET: randomBytes(32).toString('hex'),
      NODE_ENV: 'test',
    }),
    loginLimit: 1000,
    ...overrides,
  };

  if (config.dbName !== databaseName || !databaseName.startsWith('grocery_test_')) {
    throw new Error('Unsafe test database name.');
  }

  const { client, db } = await connectDatabase(config);
  let ownsDatabase = false;

  async function close() {
    try {
      if (ownsDatabase) {
        if (db.databaseName !== databaseName || !db.databaseName.startsWith('grocery_test_')) {
          throw new Error('Unsafe test cleanup.');
        }

        await db.dropDatabase();
        ownsDatabase = false;
      }
    } finally {
      await client.close();
    }
  }

  try {
    if (await db.listCollections().hasNext()) {
      throw new Error('Test database must be empty.');
    }

    ownsDatabase = true;
    const password = randomBytes(24).toString('base64url');
    await seedDatabase(db, password);

    const built = await buildApplication({
      db,
      config,
      logger: { error() {} },
    });

    return { ...built, db, config, password, close };
  } catch (error) {
    await close();
    throw error;
  }
}
