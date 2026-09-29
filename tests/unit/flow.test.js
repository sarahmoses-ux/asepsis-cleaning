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

test('Render router allows configured frontend preflight and rejects other origins', async () => {
  const router=createApiRouter({env:{SITE_URL:'https://asepsisedmond.com'},bookings:()=>assert.fail('preflight must not submit')});
  for(const [origin,expected] of [['https://asepsisedmond.com',204],['https://other.example',403]]) {
    const headers={};
    const res={setHeader(key,value){headers[key]=value;},end(){}};
    assert.equal(await router({url:'/api/bookings',method:'OPTIONS',headers:{origin}},res),true);
    assert.equal(res.statusCode,expected);
    assert.equal(headers['Access-Control-Allow-Origin'],expected===204?origin:undefined);
  }
});

test('notification saves do not overwrite payment data and pending payment cannot overwrite paid',async()=>{
  const updates=[];
  const collection={createIndex:async()=>{},updateOne:async(filter,update)=>{updates.push({filter,update});return {matchedCount:1};}};
  const store=createStore({},async()=>({collection:()=>collection}));
  await store.save({id:'one',notifications:{email:{status:'accepted'}},payment:{status:'pending'}});
  assert.equal(updates[0].update.$set.payment,undefined);
  assert.equal(updates[0].update.$set.notifications,undefined);
  assert.equal(updates[0].update.$set['notifications.email'].status,'accepted');
  await store.setPayment('one',{status:'pending',sessionId:'cs_test'});
  assert.deepEqual(updates[1].filter['payment.status'],{$ne:'paid'});
  await store.setPayment('one',{status:'paid',sessionId:'cs_test'});
  assert.deepEqual(updates[2].filter['payment.status'],{$ne:'paid'});
  assert.deepEqual(updates[2].update.$set['notifications.payment_email'],{status:'pending',attempts:0});
  assert.equal(updates[2].update.$set.notificationPending,true);
});
