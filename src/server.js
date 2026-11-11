import { readConfig } from './config.js';
import { connectDatabase, ensureIndexes } from './db.js';
import { buildApplication } from './bootstrap.js';

let client;

try {
  const config = readConfig();
  const connection = await connectDatabase(config);
  client = connection.client;

  await ensureIndexes(connection.db);

  const { app } = await buildApplication({ db: connection.db, config });
  const host = '127.0.0.1';

  const server = app.listen(config.port, host, () => {
    console.log(`Server is running at http://${host}:${config.port}`);
  });

  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;

    const deadline = setTimeout(() => process.exit(1), 10000).unref();

    server.close(async () => {
      try {
        await client.close();
      } catch {
        process.exitCode = 1;
      } finally {
        clearTimeout(deadline);
      }
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.on('error', async error => {
    console.error(JSON.stringify({
      event: 'server_failed',
      errorName: error.name,
    }));
    process.exitCode = 1;

    try {
      await client.close();
    } catch {
      process.exitCode = 1;
    }
  });
} catch (error) {
  console.error(JSON.stringify({
    event: 'startup_failed',
    errorName: error.name,
    message: 'Check environment configuration, MongoDB availability and indexes.',
  }));

  try {
    await client?.close();
  } finally {
    process.exitCode = 1;
  }
}
