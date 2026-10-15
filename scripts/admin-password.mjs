import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { passwordHash } from '../backend/admin.js';
let hidden = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk); callback(); } });
const input = createInterface({ input: process.stdin, output, terminal: true });
try {
  process.stdout.write('New admin password (minimum 12 characters, input hidden): ');
  hidden = true;
  const password = await input.question('');
  hidden = false;
  process.stdout.write('\n');
  if (password.length < 12 || password.length > 256) throw new Error('Use 12 to 256 characters.');
  console.log(`ADMIN_PASSWORD_HASH=${passwordHash(password)}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { input.close(); }
