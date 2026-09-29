import { notificationsFor, ownerPhone, smsEnabled, smsRecipients } from './bookings.js';
import { contactFor } from '../shared/site-config.js';

export function paymentEmailFor(record,env) {
  if(record.payment?.status!=='paid') throw new Error('Payment is not confirmed');
  const contact=contactFor(record.type);
  const amount=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(record.payment.amount/100);
  return {
    from:env.BOOKING_FROM_EMAIL,to:[contact.email],reply_to:record.customer.email,
    subject:`Payment received: ${amount} [${record.id.slice(0,8)}]`,
    text:[
      'Asepsis booking payment confirmed',`Reference: ${record.id}`,`Amount paid: ${amount} USD`,
      `Customer: ${record.customer.name}`,`Phone: ${record.customer.phone}`,`Email: ${record.customer.email}`,
      `Property: ${record.customer.property}`,`Service: ${record.details?.service || record.type}`,
      `Preferred date: ${record.customer.date || 'Not specified'}`,`Arrival window: ${record.customer.arrival || 'Not specified'}`,
      `Payment reference: ${record.payment.sessionId}`,`Paid at: ${record.payment.paidAt}`,
      '', 'Payment has been verified. Contact the customer to confirm appointment availability and scope.',
    ].join('\n'),
  };
}

export function createProviders(env, fetcher=fetch) {
  async function send(url,options,idField) {
    try {
      const response=await fetcher(url,{...options,signal:AbortSignal.timeout(8000)});
      // Do not log provider bodies: they can contain private data.
      if (!response.ok) return {status:response.status === 429 ? 'retry' : response.status >= 500 ? 'uncertain' : 'failed',httpStatus:response.status};
      const data=await response.json();
      return data[idField] ? {status:'accepted',providerId:data[idField]} : {status:'uncertain'};
    } catch { return {status:'uncertain'}; }
  }
  return {
    email(record) {
      return send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`booking-${record.id}`},body:JSON.stringify(notificationsFor(record,env).email)},'id');
    },
    paymentEmail(record) {
      const message=paymentEmailFor(record,env);
      return send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`booking-paid-${record.id}`},body:JSON.stringify(message)},'id');
    },
    sms(record,recipient=ownerPhone) {
      if(!smsEnabled(env)) return Promise.resolve({status:'skipped'});
      if(!record) return Promise.resolve({status:'failed'});
      let message;
      try {
        if(!smsRecipients(env).includes(recipient)) return Promise.resolve({status:'failed'});
        message=notificationsFor(record,env,recipient).sms;
      } catch { return Promise.resolve({status:'failed'}); }
      return send(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(message).toString()},'sid');
    },
  };
}

export async function dispatchNotifications(id,store,providers,{deadline=Date.now()+45000,now=Date.now}={}) {
  const token=await store.lock(id);
  if (!token) return;
  try {
    const record=await store.get(id);
    if (!record) { await store.removePending(id); return; }
    for (const channel of Object.keys(record.notifications).filter(key=>key==='email'||key==='payment_email'||/^sms(?:_\d+)?$/.test(key))) {
      // Leave time to persist progress and release the lock before Vercel ends the invocation.
      if(now()+22000>deadline) break;
      const previous=record.notifications[channel];
      // An interrupted request may already have reached a provider. Never blindly resend.
      if (previous.status === 'sending') {
        record.notifications[channel]={...previous,status:'uncertain'};
        await store.save(record);
        console.warn('Notification needs review',{id,channel,status:'uncertain'});
        continue;
      }
      if (!['pending','retry'].includes(previous.status) || previous.attempts >= 3) continue;
      record.notifications[channel]={...previous,status:'sending',attempts:previous.attempts+1,updatedAt:new Date().toISOString()};
      await store.save(record);
      let result;
      try { result=await providers[channel==='payment_email'?'paymentEmail':channel==='email'?'email':'sms'](record,previous.to||ownerPhone); } catch { result={status:'uncertain'}; }
      record.notifications[channel]={...record.notifications[channel],...result};
      if(result.status === 'retry' && record.notifications[channel].attempts >= 3) record.notifications[channel].status='failed';
      await store.save(record);
      if (result.status !== 'accepted') console.warn('Notification needs attention',{id,channel,status:record.notifications[channel].status});
    }
    if (Object.values(record.notifications).some(value=>['pending','retry'].includes(value.status))) await store.defer(id);
    else await store.removePending(id);
  } finally { await store.unlock(id,token); }
}
