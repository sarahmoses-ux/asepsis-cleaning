import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash, passwordMatches, issueSession, validSession } from '../../backend/admin.js';
import { createAdminHandler } from '../../api/admin.js';
const env = { ADMIN_EMAIL: 'owner@example.com', ADMIN_PASSWORD_HASH: passwordHash('test-password'), ADMIN_SESSION_SECRET: 'test-secret-with-at-least-32-characters', SITE_URL: 'https://example.com', MONGODB_URI: 'mongodb://test.invalid' };
async function call(handler, req) {
  let status = 200, data;
  const res = { setHeader() {}, status(code) { status = code; return this; }, json(value) { data = value; } };
  await handler({ method: 'GET', headers: {}, ...req }, res);
  return { status, data };
}
test('admin password verification rejects wrong and malformed hashes', () => {
  assert.equal(passwordMatches('test-password', env.ADMIN_PASSWORD_HASH), true);
  assert.equal(passwordMatches('wrong', env.ADMIN_PASSWORD_HASH), false);
  assert.equal(passwordMatches('test-password', 'invalid'), false);
});
test('admin sessions reject tampering, expiry, and a changed account', () => {
  const token = issueSession(env, 1000);
  assert.equal(validSession(token, env, 2000), true);
  assert.equal(validSession(token + 'x', env, 2000), false);
  assert.equal(validSession(token, env, 1801000), false);
  assert.equal(validSession(token, { ...env, ADMIN_EMAIL: 'other@example.com' }, 2000), false);
});
test('admin bookings require authentication and never query before authorization', async () => {
  let reads = 0;
  const handler = createAdminHandler({ env, storeFactory: () => ({ listAdminBookings: async () => { reads++; return []; } }) });
  assert.equal((await call(handler)).status, 401);
  assert.equal(reads, 0);
  assert.equal((await call(handler, { headers: { authorization: `Bearer ${issueSession(env)}` } })).status, 200);
  assert.equal(reads, 1);
});
test('login enforces origin, password, rate limits and missing configuration', async () => {
  let allowed = true;
  const handler = createAdminHandler({ env, storeFactory: () => ({ allowAdminLogin: async () => allowed }) });
  const req = { method: 'POST', headers: { origin: env.SITE_URL, 'content-type': 'application/json' }, body: { email: env.ADMIN_EMAIL, password: 'test-password' } };
  assert.equal((await call(handler, { ...req, headers: { ...req.headers, origin: 'https://other.example' } })).status, 403);
  assert.equal((await call(handler, { ...req, body: { ...req.body, password: 'wrong' } })).status, 401);
  const result = await call(handler, req);
  assert.equal(result.status, 200);
  assert.equal(validSession(result.data.token, env), true);
  allowed = false;
  assert.equal((await call(handler, req)).status, 429);
  assert.equal((await call(createAdminHandler({ env: {} }), req)).status, 503);
});

test('admin reports missing site and database configuration without exposing secrets', async () => {
  const req = { method: 'POST', headers: { origin: env.SITE_URL, 'content-type': 'application/json' }, body: { email: env.ADMIN_EMAIL, password: 'test-password' } };
  const missingSite = await call(createAdminHandler({ env: { ...env, SITE_URL: '' } }), req);
  assert.equal(missingSite.status, 503);
  assert.match(missingSite.data.error, /SITE_URL/);
  const missingDb = await call(createAdminHandler({ env: { ...env, MONGODB_URI: '' } }), req);
  assert.equal(missingDb.status, 503);
  assert.match(missingDb.data.error, /MONGODB_URI/);
  const failingDb = await call(createAdminHandler({ env, storeFactory: () => ({ allowAdminLogin: async () => { throw new Error('secret connection string'); } }) }), req);
  assert.equal(failingDb.status, 503);
  assert.match(failingDb.data.error, /database could not be reached/);
  assert.doesNotMatch(failingDb.data.error, /secret connection string/);
});
