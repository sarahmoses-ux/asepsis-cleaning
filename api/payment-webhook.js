import { createStore } from '../backend/store.js';
import { createStripe, confirmPayment } from '../backend/payments.js';
import { createProviders, dispatchNotifications } from '../backend/notifications.js';

export const config = { api: { bodyParser: false } };
export function createPaymentWebhook({env=process.env,storeFactory=createStore,stripeFactory=createStripe,providerFactory=createProviders,dispatch=dispatchNotifications}={}) {
  return async function handler(req,res) {
    if(req.method!=='POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
    if(!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) return res.status(503).json({error:'Payments unavailable.'});
    let event;
    try {
      let raw = req.body;
      if (raw === undefined) {
        const chunks=[]; let size=0;
        for await(const chunk of req) { size+=chunk.length; if(size>65536) return res.status(413).end(); chunks.push(chunk); }
        raw=Buffer.concat(chunks);
      }
      event=stripeFactory(env).webhooks.constructEvent(raw,req.headers['stripe-signature'],env.STRIPE_WEBHOOK_SECRET);
    } catch { return res.status(400).json({error:'Invalid webhook signature.'}); }
    try {
      if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) {
        const session=event.data.object,store=storeFactory(env);
        const record=await store.get(session.metadata?.bookingId);
        if(!record) throw new Error('Missing booking');
        if(await confirmPayment(session,record,store)) {
          // The paid state and pending alert are durable before we contact the email provider.
          try { await dispatch(record.id,store,providerFactory(env)); }
          catch { console.error('Payment saved; notification processing needs attention',{id:record.id}); }
        }
      }
      return res.status(200).json({received:true});
    } catch { console.error('Payment webhook needs attention',{eventId:event.id}); return res.status(500).json({error:'Payment update could not be saved.'}); }
  };
}
export default createPaymentWebhook();
