import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBookingHandler} from '../../api/bookings.js';
import {isEnabled,notificationsFor,requiredSettings,smsSettings,smsRecipients,validateBooking} from '../../backend/bookings.js';
import {createProviders,dispatchNotifications} from '../../backend/notifications.js';

const id='77288af4-3240-4e88-b964-5a955fc70dc9';
const env={...Object.fromEntries([...requiredSettings,...smsSettings].map(key=>[key,'test-only'])),BOOKING_SMS_ENABLED:'true',BOOKING_NOTIFICATIONS_ENABLED:'true',SITE_URL:'https://clean.example',BOOKING_FROM_EMAIL:'Bookings <bookings@clean.example>',MONGO_URI:'mongodb://localhost:27017/asepsis'};
const payload=()=>({id,type:'home',customer:{name:'Test Customer',email:'customer@example.com',phone:'4055550123',property:'Edmond',date:'',notes:''},details:{bedrooms:3,service:'standard',frequency:'fortnightly',fullBaths:2,halfBaths:0,sqft:2000,windows:0,laundry:0,addons:[]}});
function memoryStore(){
  const records=new Map(),pending=new Set(),locks=new Set();
  return {records,pendingIds:pending,
    async create(record){if(records.has(record.id))return 'existing';records.set(record.id,structuredClone(record));pending.add(record.id);return 'created';},
    async get(key){return structuredClone(records.get(key)||null);},
    async save(record){records.set(record.id,structuredClone(record));},
    async removePending(key){pending.delete(key);},async defer(key){pending.add(key);},
    async lock(key){if(locks.has(key))return null;locks.add(key);return 'token';},async unlock(key){locks.delete(key);},
  };
}
async function request(handler,body=payload(),overrides={}){
  let status=200,data;const headers={};
  const res={setHeader:(key,value)=>{headers[key]=value;},status:(code)=>{status=code;return res;},json:(value)=>{data=value;return res;},end:()=>res};
  await handler({method:'POST',body,headers:{origin:env.SITE_URL,'content-type':'application/json','x-forwarded-for':'127.0.0.1'},...overrides},res);
  return {status,data,headers};
}

test('online submission is disabled unless all server settings are present',()=>{
  assert.equal(isEnabled(env),true);
  assert.equal(isEnabled({...env,TWILIO_AUTH_TOKEN:''}),false);
  assert.equal(isEnabled({...env,BOOKING_NOTIFICATIONS_ENABLED:'false'}),false);
});

test('email-only requests save first, send once and need no Twilio configuration',async()=>{
  const emailEnv={...env,BOOKING_SMS_ENABLED:'false',TWILIO_ACCOUNT_SID:'',TWILIO_AUTH_TOKEN:'',TWILIO_MESSAGING_SERVICE_SID:'',ADDITIONAL_SMS_RECIPIENTS:'invalid-unused-number'};
  assert.equal(isEnabled(emailEnv),true);
  assert.equal(isEnabled({...emailEnv,RESEND_API_KEY:''}),false);
  const store=memoryStore(),calls=[];
  const providers=createProviders(emailEnv,async(url,options)=>{
    assert.ok(store.records.has(id));
    assert.ok(url.includes('resend.com'));
    calls.push(JSON.parse(options.body));
    return {ok:true,json:async()=>({id:'email-only-id'})};
  });
  const handler=createBookingHandler({env:emailEnv,storeFactory:()=>store,providerFactory:()=>providers});
  assert.equal((await request(handler)).status,202);
  assert.equal((await request(handler)).status,202);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].to,['asepsiscleaningservices@gmail.com']);
  assert.deepEqual(Object.keys(store.records.get(id).notifications),['email']);
  assert.equal(store.records.get(id).notifications.email.status,'accepted');
  assert.equal(store.pendingIds.size,0);
  assert.deepEqual(await providers.sms(validateBooking(payload())),{status:'skipped'});
  assert.equal(calls.length,1);
});

test('SMS is opt-in and email-only failures retain the saved request',async()=>{
  const emailEnv={...env,BOOKING_SMS_ENABLED:undefined};
  const store=memoryStore();
  const handler=createBookingHandler({env:emailEnv,storeFactory:()=>store,providerFactory:()=>({email:async()=>({status:'retry',httpStatus:429}),sms:async()=>assert.fail('SMS must stay off')})});
  assert.equal((await request(handler)).status,202);
  assert.equal(store.records.get(id).notifications.email.status,'retry');
  assert.equal(store.pendingIds.has(id),true);
  assert.equal(store.records.get(id).notifications.sms,undefined);
});

test('MongoDB configuration is required for the booking backend',()=>{
  assert.equal(isEnabled({...env,MONGODB_URI:'mongodb://localhost:27017/asepsis'}),true);
  assert.equal(isEnabled({...env,MONGO_URI:'',MONGODB_URI:''}),false);
  assert.equal(isEnabled({...env,MONGO_URI:'mongodb://localhost:27017/asepsis',MONGODB_URI:''}),true);
});
test('server computes prices, ignores submitted totals and rejects invalid fields',()=>{
  const body=payload();body.pricing={total:1};
  assert.equal(validateBooking(body).pricing.total,160);
  assert.equal(validateBooking(body).pricing.firstVisit,305);
  body.details.bedrooms=0;assert.throws(()=>validateBooking(body),/bedrooms/);
  body.details.bedrooms=3;body.details.addons=['unknown'];assert.throws(()=>validateBooking(body),/add-ons/);
  body.details.addons=[];body.customer.date='2026-02-30';assert.throws(()=>validateBooking(body),/future date/);
});

test('booking days are Monday through Saturday and arrival windows are limited to the approved time slots',()=>{
  const today = new Date();
  const nextSunday = new Date(today);
  while (new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Chicago' }).format(nextSunday) !== 'Sunday') nextSunday.setDate(nextSunday.getDate() + 1);
  const isoSunday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(nextSunday).replace('/', '-').replace('/', '-');
  const valid=validateBooking({...payload(),customer:{...payload().customer,date:'2026-09-28',arrival:'9-10am'}});
  assert.equal(valid.customer.arrival,'9-10am');
  assert.throws(()=>validateBooking({...payload(),customer:{...payload().customer,date:isoSunday,arrival:'9-10am'}}),/Sunday/);
  assert.throws(()=>validateBooking({...payload(),customer:{...payload().customer,date:'2026-09-28',arrival:'8-9am'}}),/9:00 AM|12:00 PM|3:00 PM/);
});
test('notification recipients are fixed server-side and depend on the service',()=>{
  const record=validateBooking({...payload(),to:'attacker@example.com'});
  const home=notificationsFor(record,env);
  assert.deepEqual(home.email.to,['asepsiscleaningservices@gmail.com']);
  assert.equal(home.email.reply_to,'customer@example.com');
  assert.equal(home.sms.To,'+14055497722');
  assert.ok(!home.sms.Body.includes('Edmond'));
  const project=notificationsFor({...record,type:'project'},env);
  assert.deepEqual(project.email.to,['asepsisedmond@gmail.com']);
});
test('booking is persisted before providers run and duplicate submissions send once',async()=>{
  const store=memoryStore();const calls=[];
  const providers=Object.fromEntries(['email','sms'].map(channel=>[channel,async record=>{assert.ok(store.records.has(record.id));calls.push(channel);return {status:'accepted',providerId:channel+'-id'};}]));
  const handler=createBookingHandler({env,storeFactory:()=>store,providerFactory:()=>providers});
  const results=await Promise.all([request(handler),request(handler)]);
  assert.ok(results.every(result=>result.status===202));
  assert.deepEqual(calls,['email','sms']);
  assert.equal(store.records.size,1);
  const altered=payload();altered.customer.name='Different request';
  assert.equal((await request(handler,altered)).status,409);
});
test('storage failure cannot claim receipt or send alerts',async()=>{
  let sent=false;
  const handler=createBookingHandler({env,storeFactory:()=>({create:async()=>{throw new Error('offline');}}),providerFactory:()=>{sent=true;}});
  assert.equal((await request(handler)).status,503);
  assert.equal(sent,false);
});
test('partial provider failure does not lose the request or resend accepted email',async()=>{
  const store=memoryStore();let emails=0,sms=0;
  const providers={email:async()=>{emails++;return {status:'accepted',providerId:'email-id'};},sms:async()=>{sms++;return sms===1?{status:'retry',httpStatus:429}:{status:'accepted',providerId:'sms-id'};}};
  const handler=createBookingHandler({env,storeFactory:()=>store,providerFactory:()=>providers});
  assert.equal((await request(handler)).status,202);
  assert.equal(store.records.get(id).notifications.sms.status,'retry');
  await dispatchNotifications(id,store,providers);
  assert.equal(emails,1);assert.equal(sms,2);assert.equal(store.pendingIds.size,0);
});
test('uncertain and interrupted sends are not blindly retried',async()=>{
  const store=memoryStore();let sends=0;
  await store.create({...validateBooking(payload()),notifications:{email:{status:'sending',attempts:1},sms:{status:'pending',attempts:0}}});
  const providers={email:async()=>{throw new Error('must not resend');},sms:async()=>{sends++;throw new Error('timeout');}};
  await dispatchNotifications(id,store,providers);
  await dispatchNotifications(id,store,providers);
  assert.equal(store.records.get(id).notifications.email.status,'uncertain');
  assert.equal(store.records.get(id).notifications.sms.status,'uncertain');
  assert.equal(sends,1);
});
test('origin, oversized requests and rate limits fail before notifications',async()=>{
  const handler=createBookingHandler({env,storeFactory:()=>({create:async()=> 'limited'})});
  assert.equal((await request(handler,payload(),{headers:{origin:'https://other.example','content-type':'application/json'}})).status,403);
  assert.equal((await request(handler,{...payload(),extra:'x'.repeat(17000)})).status,413);
  assert.equal((await request(handler)).status,429);
  assert.equal((await request(handler,null,{method:'DELETE'})).status,405);
});
test('provider adapters send email and SMS independently without exposing credentials to clients',async()=>{
  const calls=[];
  const providers=createProviders(env,async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('resend')?{id:'email-id'}:{sid:'sms-id'}};});
  const record=validateBooking(payload());
  assert.equal((await providers.email(record)).status,'accepted');
  assert.equal((await providers.sms(record)).status,'accepted');
  assert.equal(JSON.parse(calls[0].options.body).to[0],'asepsiscleaningservices@gmail.com');
  assert.equal(calls[0].options.headers['Idempotency-Key'],'booking-'+id);
  assert.equal(new URLSearchParams(calls[1].options.body).get('To'),'+14055497722');
  const result=await request(createBookingHandler({env}),null,{method:'GET'});
  assert.deepEqual(result.data,{enabled:true});
});

test('additional recipients are deduplicated and require international format',()=>{
  assert.deepEqual(smsRecipients({...env,ADDITIONAL_SMS_RECIPIENTS:'+14055497722, +15555550123, +15555550123'}),['+14055497722','+15555550123']);
  assert.equal(isEnabled({...env,ADDITIONAL_SMS_RECIPIENTS:'0555550123'}),false);
});

test('each phone has independent delivery state and retries do not resend successful alerts',async()=>{
  const multiEnv={...env,ADDITIONAL_SMS_RECIPIENTS:'+15555550123'};
  const store=memoryStore(), sent=[];let secondAttempts=0;
  const providers={email:async()=>{sent.push('email');return {status:'accepted',providerId:'email'};},sms:async(record,to)=>{
    sent.push(to);
    if(to==='+15555550123' && ++secondAttempts===1) return {status:'retry',httpStatus:429};
    return {status:'accepted',providerId:to};
  }};
  const handler=createBookingHandler({env:multiEnv,storeFactory:()=>store,providerFactory:()=>providers});
  const body={...payload(),recipients:['+15555550999']};
  assert.equal((await request(handler,body)).status,202);
  assert.deepEqual(sent,['email','+14055497722','+15555550123']);
  assert.equal(store.records.get(id).notifications.sms_1.to,'+15555550123');
  await dispatchNotifications(id,store,providers);
  assert.deepEqual(sent,['email','+14055497722','+15555550123','+15555550123']);
  assert.equal(store.records.get(id).notifications.sms_1.status,'accepted');
});

test('Twilio adapter sends only to the selected configured recipient',async()=>{
  const destinations=[];
  const providers=createProviders({...env,ADDITIONAL_SMS_RECIPIENTS:'+15555550123'},async(url,options)=>{
    destinations.push(new URLSearchParams(options.body).get('To'));
    return {ok:true,json:async()=>({sid:'test'})};
  });
  assert.equal((await providers.sms(validateBooking(payload()),'+15555550123')).status,'accepted');
  assert.equal((await providers.sms(validateBooking(payload()),'+15555550999')).status,'failed');
  assert.deepEqual(destinations,['+15555550123']);
});

test('notifications remain queued when an invocation is close to its time limit',async()=>{
  const store=memoryStore();let sends=0;
  await store.create({...validateBooking(payload()),notifications:{email:{status:'pending',attempts:0},sms:{status:'pending',attempts:0}}});
  const providers={email:async()=>{sends++;},sms:async()=>{sends++;}};
  await dispatchNotifications(id,store,providers,{deadline:20000,now:()=>1000});
  assert.equal(sends,0);
  assert.equal(store.records.get(id).notifications.email.status,'pending');
  assert.equal(store.pendingIds.has(id),true);
  assert.equal(await store.lock(id),'token');
});
