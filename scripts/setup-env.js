import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
const content = source
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString('base64url')}`)
  .replace(/^SEED_PASSWORD=.*$/m, `SEED_PASSWORD=${randomBytes(24).toString('base64url')}`);

try {
  await writeFile(new URL('../.env', import.meta.url), content, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('Created .env with a random JWT secret and local demo password.');
} catch (error) {
  if (error.code !== 'EEXIST') {
    throw error;
  }

  console.log('.env already exists; existing configuration was preserved.');
}
