import { createHmac, timingSafeEqual } from 'node:crypto';
import Stripe from 'stripe';
import { BookingError } from './bookings.js';

export function paymentsEnabled(env) {
  return env.PAYMENTS_ENABLED === 'true' && ['STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET','CRON_SECRET','SITE_URL','RESEND_API_KEY','BOOKING_FROM_EMAIL'].every(key => Boolean(env[key]?.trim()));
}
export function createStripe(env) { return new Stripe(env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 1 }); }
export function bookingToken(id, env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ id, expires: now + 86400000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', env.CRON_SECRET).update(payload).digest('hex')}`;
}
export function verifyBookingToken(token, id, env, now = Date.now()) {
  try {
    const [payload, signature, extra] = String(token).split('.');
    if (extra || !/^[a-f0-9]{64}$/.test(signature)) return false;
    const expected = createHmac('sha256', env.CRON_SECRET).update(payload).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature,'hex'))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.id === id && data.expires > now;
  } catch { return false; }
}
export function paymentAmount(record) {
  const amount = Math.round(record.pricing?.firstVisit * 100);
  if (record.type !== 'home' || !Number.isSafeInteger(amount) || amount <= 0) throw new BookingError(409, 'This project needs an agreed quote before payment.');
  return amount;
}
export async function confirmPayment(session, record, store) {
  if (session.metadata?.bookingId !== record.id || session.amount_total !== paymentAmount(record) || session.currency !== 'usd' || session.mode !== 'payment') throw new BookingError(409, 'Payment details do not match this booking. Please contact our team.');
  if (record.payment?.sessionId && record.payment.sessionId !== session.id) throw new BookingError(409, 'Payment session does not match this booking.');
  if (session.payment_status !== 'paid') return false;
  await store.setPayment(record.id, { status:'paid', sessionId:session.id, amount:session.amount_total, currency:'usd', paidAt:new Date().toISOString() });
  return true;
}
