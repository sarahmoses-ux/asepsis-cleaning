import { BookingError, fingerprint, isEnabled, notificationStates, validateBooking } from '../backend/bookings.js';
import { createStore } from '../backend/store.js';
import { createProviders, dispatchNotifications } from '../backend/notifications.js';
import { bookingToken, paymentsEnabled } from '../backend/payments.js';

export function createBookingHandler({env=process.env,storeFactory=createStore,providerFactory=createProviders,dispatch=dispatchNotifications}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method==='GET') return res.status(200).json({enabled:isEnabled(env)});
    if(req.method!=='POST') { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'}); }
    if(!isEnabled(env)) return res.status(503).json({error:'Online booking is temporarily unavailable. Your request has not been saved. Please try again shortly or call our team.'});
    const deadline=Date.now()+45000;
    try {
      if(req.headers.origin !== new URL(env.SITE_URL).origin) throw new BookingError(403,'Please submit your request from our website.');
      if(!String(req.headers['content-type']||'').startsWith('application/json')) throw new BookingError(415,'Please send a JSON request.');
      if(Number(req.headers['content-length'])>16000 || Buffer.byteLength(JSON.stringify(req.body || ''))>16000) throw new BookingError(413,'Your request is too long. Please shorten the notes.');
      let body=req.body;
      if(typeof body==='string') { try { body=JSON.parse(body); } catch { throw new BookingError(400,'Please check your request.'); } }
      const booking=validateBooking(body);
      const hash=fingerprint(booking);
      const store=storeFactory(env);
      const record={...booking,fingerprint:hash,createdAt:new Date().toISOString(),status:'requested',notifications:notificationStates(env)};
      const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
      const result=await store.create(record,ip);
      if(result==='limited') throw new BookingError(429,'Too many requests. Please call 405-549-7722 for help.');
      if(!['created','existing'].includes(result)) throw new Error('Booking persistence was not confirmed');
      let summary=booking;
      if(result==='existing') {
        const saved=await store.get(booking.id);
        if(saved?.fingerprint!==hash) throw new BookingError(409,'This request reference has already been used. Please refresh before starting a different request.');
        summary={id:saved.id,type:saved.type,customer:saved.customer,details:saved.details,pricing:saved.pricing};
      }
      // The request is saved first. Notification failures never erase it or ask the customer to resubmit.
      try { await dispatch(booking.id,store,providerFactory(env),{deadline}); }
      catch { console.error('Booking saved; notification processing needs attention',{id:booking.id}); }
      return res.status(202).json({id:booking.id,status:'requested',booking:summary,accessToken:bookingToken(booking.id,env),paymentAvailable:paymentsEnabled(env),message:'Your request has been received. Our team will contact you to confirm availability.'});
    } catch(error) {
      if(error instanceof BookingError) return res.status(error.status).json({error:error.message});
      console.error('Booking service unavailable');
      return res.status(503).json({error:'We could not confirm receipt. Please retry with the same details, or call 405-549-7722.'});
    }
  };
}
export default createBookingHandler();
