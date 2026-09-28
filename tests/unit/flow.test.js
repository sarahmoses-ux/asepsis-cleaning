import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStore } from '../../backend/store.js';
import { createApiRouter } from '../../backend/http.js';

test('MongoDB document return acquires the notification lock; missing document does not', async () => {
  let found = true;
  const collection = {
    createIndex: async () => 'id_1',
    findOneAndUpdate: async (filter, update) => found ? { id: filter.id, ...update.$set } : null,
  };
  const store = createStore({}, async () => ({ collection: () => collection }));
  assert.match(await store.lock('request'), /^[a-f0-9-]{36}$/);
  found = false;
  assert.equal(await store.lock('request'), null);
});

test('standalone HTTP router passes a submitted request to the booking handler', async t => {
  let submitted;
  const router = createApiRouter({ bookings: async (req, res) => {
    submitted = JSON.parse(req.body);
    res.status(202).json({ id: submitted.id, status: 'requested' });
  } });
  const server = http.createServer(async (req, res) => {
    if (!await router(req, res)) { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'request' }),
  });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { id: 'request', status: 'requested' });
  assert.equal(submitted.id, 'request');
});
