import {test} from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {bookingToken,verifyBookingToken,paymentsEnabled,confirmPayment} from '../../backend/payments.js';
import {createCheckoutHandler} from '../../api/checkout.js';
import {createPaymentWebhook} from '../../api/payment-webhook.js';
const env={RESEND_API_KEY:'re_test',BOOKING_FROM_EMAIL:'bookings@example.com',PAYMENTS_ENABLED:'true',SITE_URL:'https://clean.example',CRON_SECRET:'test-secret',STRIPE_SECRET_KEY:'sk_test_dummy',STRIPE_PUBLISHABLE_KEY:'pk_test_dummy',STRIPE_WEBHOOK_SECRET:'whsec_dummy'};
const record=()=>({id:'booking-1',type:'home',customer:{email:'customer@example.com'},pricing:{firstVisit:305,total:160,recurring:true}});
function storeFor(record){
 let locked=false;
 record.notifications ??= {email:{status:'accepted',attempts:1}};
 return {record,
  async get(id){return id===record.id?structuredClone(record):null;},
  async lock(){if(locked)return null;locked=true;return 'lock';},async unlock(){locked=false;},
  async setPayment(id,payment){if(record.payment?.status==='paid')return;record.payment=payment;if(payment.status==='paid'){record.notifications.payment_email={status:'pending',attempts:0};record.notificationPending=true;}},
  async save(saved){Object.assign(record.notifications,saved.notifications);},
  async defer(){record.notificationPending=true;},async removePending(){record.notificationPending=false;},
 };
}
const providerFactory=()=>({paymentEmail:async()=>({status:'accepted',providerId:'mock-paid-email'})});
async function request(handler,{method='POST',body={id:'booking-1',amount:1},headers={},url='/api/checkout?id=booking-1'}={}){
 let status=200,data;
 const res={setHeader(){},status(code){status=code;return res;},json(value){data=value;return res;},end(){return res;}};
 await handler({method,url,body,headers:{origin:env.SITE_URL,'content-type':'application/json',authorization:'Bearer '+bookingToken('booking-1',env),...headers}},res);
 return {status,data};
}
test('payment credentials are opt-in; booking token rejects tampering, other IDs and expiry',()=>{
 assert.equal(paymentsEnabled(env),true);assert.equal(paymentsEnabled({...env,PAYMENTS_ENABLED:'false'}),false);
 assert.equal(paymentsEnabled({...env,STRIPE_WEBHOOK_SECRET:''}),false);
 const token=bookingToken('booking-1',env,1000);
 assert.equal(verifyBookingToken(token,'booking-1',env,2000),true);
 assert.equal(verifyBookingToken(token,'booking-2',env,2000),false);
 assert.equal(verifyBookingToken(token+'x','booking-1',env,2000),false);
 assert.equal(verifyBookingToken(token,'booking-1',env,86402000),false);
});
test('checkout charges saved first-visit total and reuses session on repeat clicks',async()=>{
 const store=storeFor(record());let creates=0;
 const session={id:'cs_test_one',status:'open',payment_status:'unpaid',metadata:{bookingId:'booking-1'},amount_total:30500,currency:'usd',mode:'payment',client_secret:'secret'};
 const stripe={checkout:{sessions:{retrieve:async()=>session,create:async(body,options)=>{
  creates++;assert.equal(body.line_items[0].price_data.unit_amount,30500);assert.equal(body.mode,'payment');assert.equal(body.ui_mode,'embedded_page');assert.equal(body.redirect_on_completion,'never');assert.equal(options.idempotencyKey,'asepsis-booking-booking-1');return session;
 }}}};
 const handler=createCheckoutHandler({env,providerFactory,storeFactory:()=>store,stripeFactory:()=>stripe});
 assert.equal((await request(handler)).data.clientSecret,'secret');
 assert.equal((await request(handler)).data.clientSecret,'secret');assert.equal(creates,1);
 session.payment_status='paid';session.status='complete';
 assert.equal((await request(handler,{method:'GET'})).data.status,'paid');
 assert.equal(store.record.payment.status,'paid');
 assert.equal((await request(handler)).data.status,'paid');assert.equal(creates,1);
});
test('checkout rejects commercial, forged access, wrong origin and disabled payments',async()=>{
 const store=storeFor({...record(),type:'project',pricing:null});
 const handler=createCheckoutHandler({env,providerFactory,storeFactory:()=>store,stripeFactory:()=>assert.fail('must not contact Stripe')});
 assert.equal((await request(handler)).status,409);
 assert.equal((await request(handler,{headers:{authorization:'Bearer bad'}})).status,403);
 assert.equal((await request(handler,{headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await request(createCheckoutHandler({env:{...env,PAYMENTS_ENABLED:'false'}}))).status,503);
});
test('only paid sessions with matching booking and amount can mark a booking paid',async()=>{
 const store=storeFor(record());
 const session={id:'cs_1',metadata:{bookingId:'booking-1'},currency:'usd',mode:'payment',amount_total:30500,payment_status:'unpaid'};
 assert.equal(await confirmPayment(session,store.record,store),false);
 assert.equal(store.record.payment,undefined);
 await assert.rejects(confirmPayment({...session,payment_status:'paid',amount_total:1},store.record,store));
 await assert.rejects(confirmPayment({...session,payment_status:'paid',metadata:{bookingId:'other'}},store.record,store));
 assert.equal(await confirmPayment({...session,payment_status:'paid'},store.record,store),true);
});
test('signed webhook persists payment; forged signature cannot change records',async()=>{
 const stripe=new Stripe(env.STRIPE_SECRET_KEY),store=storeFor(record());
 const handler=createPaymentWebhook({env,providerFactory,storeFactory:()=>store,stripeFactory:()=>stripe});
 const payload=JSON.stringify({id:'evt_test',type:'checkout.session.completed',data:{object:{id:'cs_test_one',metadata:{bookingId:'booking-1'},payment_status:'paid',amount_total:30500,currency:'usd',mode:'payment'}}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET});
 assert.equal((await request(handler,{body:payload,headers:{'stripe-signature':'invalid'}})).status,400);
 assert.equal(store.record.payment,undefined);
 assert.equal((await request(handler,{body:payload,headers:{'stripe-signature':signature}})).status,200);
 assert.equal(store.record.payment.status,'paid');
 assert.equal((await request(handler,{body:payload,headers:{'stripe-signature':signature}})).status,200);
});
import { createProviders, dispatchNotifications, paymentEmailFor } from '../../backend/notifications.js';
import { startNotificationWorker } from '../../backend/notification-worker.js';

test('payment email includes verified amount and uses a different idempotency key from booking email',async()=>{
 const booking={...record(),customer:{name:'Test Customer',email:'customer@example.com',phone:'4055550123',property:'Test property'},details:{service:'standard'},payment:{status:'paid',amount:30500,sessionId:'cs_paid',paidAt:'2026-09-29T12:00:00Z'}};
 const messages=[];
 const providers=createProviders(env,async(url,options)=>{messages.push({message:JSON.parse(options.body),key:options.headers['Idempotency-Key']});return {ok:true,json:async()=>({id:'mock-email'})};});
 await providers.email(booking);await providers.paymentEmail(booking);
 assert.equal(messages[0].key,'booking-booking-1');
 assert.equal(messages[1].key,'booking-paid-booking-1');
 assert.deepEqual(messages[1].message.to,['asepsisedmond@gmail.com']);
 assert.match(messages[1].message.subject,/Payment received: \$305\.00/);
 assert.match(messages[1].message.text,/Customer: Test Customer/);
 assert.match(messages[1].message.text,/Payment reference: cs_paid/);
 assert.throws(()=>paymentEmailFor({...booking,payment:{status:'pending'}},env),/not confirmed/);
});

test('verified duplicate webhooks notify once, after payment is saved, even without a browser return',async()=>{
 const stripe=new Stripe(env.STRIPE_SECRET_KEY),store=storeFor(record());let emails=0;
 const handler=createPaymentWebhook({env,storeFactory:()=>store,stripeFactory:()=>stripe,providerFactory:()=>({
  email:async()=>assert.fail('original booking notification must not be resent'),
  paymentEmail:async saved=>{assert.equal(store.record.payment.status,'paid');assert.equal(saved.payment.amount,30500);emails++;return {status:'accepted',providerId:'paid-mail'};},
 })});
 const event={id:'evt_payment',type:'checkout.session.completed',data:{object:{id:'cs_paid',metadata:{bookingId:'booking-1'},payment_status:'unpaid',amount_total:30500,currency:'usd',mode:'payment'}}};
 async function deliver(){const body=JSON.stringify(event);return request(handler,{body,headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload:body,secret:env.STRIPE_WEBHOOK_SECRET})}});}
 assert.equal((await deliver()).status,200);assert.equal(emails,0);
 event.data.object.payment_status='paid';
 assert.equal((await deliver()).status,200);
 assert.equal((await deliver()).status,200);
 assert.equal(emails,1);
 assert.equal(store.record.notifications.payment_email.status,'accepted');
 assert.equal(store.record.notifications.payment_email.attempts,1);
 assert.equal(store.record.notificationPending,false);
});

test('failed payment alert remains queued and retry does not resend the request email',async()=>{
 const store=storeFor(record());
 await store.setPayment('booking-1',{status:'paid',amount:30500,sessionId:'cs_paid'});
 let paidAttempts=0;
 const providers={email:async()=>assert.fail('must not resend booking email'),paymentEmail:async()=>++paidAttempts===1?{status:'retry',httpStatus:429}:{status:'accepted',providerId:'paid-mail'}};
 await dispatchNotifications('booking-1',store,providers);
 assert.equal(store.record.payment.status,'paid');assert.equal(store.record.notificationPending,true);
 assert.equal(store.record.notifications.payment_email.status,'retry');
 await dispatchNotifications('booking-1',store,providers);
 await dispatchNotifications('booking-1',store,providers);
 assert.equal(paidAttempts,2);assert.equal(store.record.notificationPending,false);
});

test('Render worker recovers queued alerts without overlapping runs',async t=>{
 const workerEnv={...env,BOOKING_NOTIFICATIONS_ENABLED:'true',MONGODB_URI:'mongodb://test-only'};
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const dispatched=[];
 const worker=startNotificationWorker({env:workerEnv,storeFactory:()=>({pending:async()=>['saved-paid-booking']}),providerFactory:()=>({}),dispatch:async id=>{dispatched.push(id);await waiting;}});
 t.after(worker.stop);
 const first=worker.tick();await worker.tick();release();await first;
 assert.deepEqual(dispatched,['saved-paid-booking']);
});
