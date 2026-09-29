import { BookingError } from '../backend/bookings.js';
import { createStore } from '../backend/store.js';
import { paymentsEnabled, createStripe, verifyBookingToken, paymentAmount, confirmPayment } from '../backend/payments.js';
import { createProviders, dispatchNotifications } from '../backend/notifications.js';

export function createCheckoutHandler({env=process.env,storeFactory=createStore,stripeFactory=createStripe,providerFactory=createProviders,dispatch=dispatchNotifications}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'}); }
    let store, id, lock;
    const deadline=Date.now()+45000;
    async function paidResponse(amount) {
      // Release the checkout lock before notification dispatch takes the same booking lock.
      await store.unlock(id,lock); lock=null;
      try { await dispatch(id,store,providerFactory(env),{deadline}); }
      catch { console.error('Payment saved; notification processing needs attention',{id}); }
      return res.status(200).json({status:'paid',amount,currency:'usd'});
    }
    try {
      if (!paymentsEnabled(env)) throw new BookingError(503,'Online payment is not available yet. Your saved booking is safe; no payment has been taken.');
      if (req.method==='POST' && req.headers.origin !== new URL(env.SITE_URL).origin) throw new BookingError(403,'Please pay from our website.');
      let body = {};
      if (req.method==='POST') {
        if (!String(req.headers['content-type']||'').startsWith('application/json')) throw new BookingError(415,'Please send a JSON request.');
        try { body = typeof req.body==='string' ? JSON.parse(req.body) : req.body; } catch { throw new BookingError(400,'Invalid request.'); }
      }
      id = req.method==='GET' ? new URL(req.url,'http://localhost').searchParams.get('id') : body?.id;
      const token = String(req.headers.authorization||'').replace(/^Bearer /,'');
      if (!verifyBookingToken(token,id,env)) throw new BookingError(403,'Your payment access has expired. Please contact our team with your booking reference.');
      store = storeFactory(env);
      lock = await store.lock(id);
      if (!lock) throw new BookingError(409,'Your booking is being updated. Please try again in a moment.');
      const record = await store.get(id);
      if (!record) throw new BookingError(404,'Booking not found.');
      const amount = paymentAmount(record);
      if (record.payment?.status==='paid') return await paidResponse(amount);
      const stripe = stripeFactory(env);
      let session;
      if (record.payment?.sessionId) {
        session = await stripe.checkout.sessions.retrieve(record.payment.sessionId);
        if (await confirmPayment(session,record,store)) return await paidResponse(amount);
      }
      if (req.method==='GET') return res.status(200).json({status:session?.status==='expired'?'expired':'unpaid',amount,currency:'usd'});
      if (session?.status==='expired') throw new BookingError(409,'This payment session has expired. Contact our team to arrange payment for your saved booking.');
      if (session?.status==='complete') return res.status(200).json({status:'processing',amount,currency:'usd'});
      if (!session) {
        const started = record.payment?.attemptStarted || new Date().toISOString();
        if (Date.now()-Date.parse(started)>23*60*60*1000) throw new BookingError(409,'Please contact our team to check the previous payment attempt before trying again.');
        await store.setPayment(id,{status:'creating',attemptStarted:started,amount,currency:'usd'});
        session = await stripe.checkout.sessions.create({
          ui_mode:'embedded_page',mode:'payment',payment_method_types:['card'],redirect_on_completion:'never',
          customer_email:record.customer.email,client_reference_id:id,metadata:{bookingId:id},
          line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:amount,product_data:{name:'Asepsis residential cleaning — first visit'}}}],
        },{idempotencyKey:`asepsis-booking-${id}`});
        await store.setPayment(id,{status:'pending',sessionId:session.id,attemptStarted:started,amount,currency:'usd'});
      }
      return res.status(200).json({status:'unpaid',clientSecret:session.client_secret,publishableKey:env.STRIPE_PUBLISHABLE_KEY,amount,currency:'usd'});
    } catch(error) {
      if (error instanceof BookingError) return res.status(error.status).json({error:error.message});
      console.error('Payment service needs attention',{id});
      return res.status(503).json({error:'Payment could not be confirmed. Your booking is saved. Please retry here; do not create another booking.'});
    } finally { if (lock) { try { await store.unlock(id,lock); } catch { console.error('Payment lock release failed',{id}); } } }
  };
}
export default createCheckoutHandler();
