import { createHash } from 'node:crypto';
import { estimate, extras } from '../src/pricing.js';
import { contactFor } from '../src/site-config.js';

export const ownerPhone = '+14055497722';
export function smsRecipients(env) {
  const additional=(env.ADDITIONAL_SMS_RECIPIENTS||'').split(',').map(value=>value.trim()).filter(Boolean);
  const recipients=[...new Set([ownerPhone,...additional])];
  if(recipients.length>4 || recipients.some(value=>!/^\+[1-9]\d{7,14}$/.test(value))) throw new Error('SMS recipients must use international format');
  return recipients;
}
export function notificationStates(env) {
  return {email:{status:'pending',attempts:0},...Object.fromEntries(smsRecipients(env).map((to,index)=>[index===0?'sms':`sms_${index}`,{status:'pending',attempts:0,to}]))};
}
export const retentionSeconds = 90 * 24 * 60 * 60;
export const requiredSettings = ['SITE_URL', 'RESEND_API_KEY', 'BOOKING_FROM_EMAIL', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_MESSAGING_SERVICE_SID', 'CRON_SECRET'];
export function mongoUri(env) {
  return env.MONGODB_URI || env.MONGO_URI || '';
}
export function isEnabled(env) {
  try { smsRecipients(env); } catch { return false; }
  return env.BOOKING_NOTIFICATIONS_ENABLED === 'true' && requiredSettings.every(key => Boolean(env[key]?.trim())) && Boolean(mongoUri(env).trim());
}
export class BookingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function text(value, field, max, optional = false) {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new BookingError(400, `Please check ${field}.`);
  return value.trim();
}
function arrivalWindow(value) {
  const allowed = new Set(['9-10am','12-1pm','3-4pm']);
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || !allowed.has(value.trim())) throw new BookingError(400, 'Please select a valid arrival window: 9:00 AM, 12:00 PM, or 3:00 PM.');
  return value.trim();
}
function integer(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new BookingError(400, `Please check ${field}.`);
  return value;
}
export function validateBooking(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BookingError(400, 'Please check your request.');
  if (body.website) throw new BookingError(400, 'Please call our team to request a clean.');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id || '')) throw new BookingError(400, 'Please refresh the page and try again.');
  if (!['home', 'project'].includes(body.type)) throw new BookingError(400, 'Please choose a service type.');
  const customer = {
    name: text(body.customer?.name, 'your name', 100),
    email: text(body.customer?.email, 'your email', 254),
    phone: text(body.customer?.phone, 'your phone number', 40),
    property: text(body.customer?.property, 'your property address or city', 300),
    date: text(body.customer?.date, 'your preferred date', 10, true),
    arrival: arrivalWindow(body.customer?.arrival),
    notes: text(body.customer?.notes, 'your notes', 3000, true),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new BookingError(400, 'Please enter a valid email address.');
  if (!/^[+()\d .-]+$/.test(customer.phone) || customer.phone.replace(/\D/g, '').length < 10 || customer.phone.replace(/\D/g, '').length > 15) throw new BookingError(400, 'Please enter a valid phone number.');
  if (/[\r\n]/.test(customer.name + customer.email + customer.phone + customer.property)) throw new BookingError(400, 'Please use a single line for your contact details.');
  if (customer.date) {
    const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const parsed = new Date(customer.date + 'T12:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customer.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== customer.date || customer.date < today) throw new BookingError(400, 'Please choose today or a future date.');
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Chicago' }).format(parsed);
    if (weekday === 'Sunday') throw new BookingError(400, 'Bookings are available Monday through Saturday only. Sunday is not available for cleaning appointments.');
  }
  if (customer.arrival && !customer.date) throw new BookingError(400, 'Please choose a date before selecting an arrival window.');
  let details, pricing = null;
  if (body.type === 'home') {
    const c = body.details || {};
    if (!['standard','deep','move'].includes(c.service) || !['weekly','fortnightly','monthly','once'].includes(c.frequency)) throw new BookingError(400, 'Please check the cleaning service and frequency.');
    if (!Array.isArray(c.addons) || c.addons.length > 5 || c.addons.some(key => !Object.hasOwn(extras,key)) || new Set(c.addons).size !== c.addons.length) throw new BookingError(400, 'Please check the selected add-ons.');
    details = {
      service:c.service, frequency:c.service === 'standard' ? c.frequency : 'once',
      bedrooms:integer(c.bedrooms,'bedrooms',1,5), fullBaths:integer(c.fullBaths,'full bathrooms',1,100),
      halfBaths:integer(c.halfBaths,'half bathrooms',0,100), sqft:integer(c.sqft,'square footage',1,100000),
      windows:integer(c.windows,'windows',0,100), laundry:integer(c.laundry,'laundry loads',0,100),
      addons:c.addons.filter(key => c.service !== 'move' || !['oven','fridge','cabinets'].includes(key)).sort(),
    };
    pricing = estimate(details); // Never trust a price sent by the browser.
  } else {
    const c = body.details || {};
    if (!['Post-Construction','Office / Janitorial','Apartment Turnover','Hotel','Pressure Washing','Other'].includes(c.service) || !['One-time','Weekly','Every 2 weeks','Every 4 weeks','Not sure'].includes(c.frequency)) throw new BookingError(400,'Please check your project details.');
    details = {service:c.service,frequency:c.frequency,sqft:c.sqft === '' || c.sqft === undefined ? '' : integer(c.sqft,'square footage',1,10000000)};
  }
  return {id:body.id,type:body.type,customer,details,pricing};
}
export function fingerprint(booking) { return createHash('sha256').update(JSON.stringify(booking)).digest('hex'); }
export function notificationsFor(record, env, recipient=ownerPhone) {
  if(!smsRecipients(env).includes(recipient)) throw new Error('SMS recipient is not configured');
  const contact = contactFor(record.type);
  const lines = [
    `New ${record.type === 'home' ? 'residential' : 'commercial'} booking request`,
    `Reference: ${record.id}`, `Name: ${record.customer.name}`, `Phone: ${record.customer.phone}`,
    `Email: ${record.customer.email}`, `Property: ${record.customer.property}`, `Preferred date: ${record.customer.date || 'Not specified'}`,
    ...Object.entries(record.details).map(([key,value]) => `${key}: ${Array.isArray(value) ? value.join(', ') || 'None' : value}`),
    ...(record.pricing ? [`First-visit estimate: $${record.pricing.firstVisit}`, ...(record.pricing.recurring ? [`Recurring estimate: $${record.pricing.total} per visit`] : [])] : []),
    `Notes: ${record.customer.notes || 'None'}`, '', 'This is a request. Contact the customer to confirm availability and scope.',
  ];
  return {
    email:{from:env.BOOKING_FROM_EMAIL,to:[contact.email],reply_to:record.customer.email,subject:`New ${record.type === 'home' ? 'residential' : 'commercial'} request [${record.id.slice(0,8)}]`,text:lines.join('\n')},
    sms:{To:recipient,MessagingServiceSid:env.TWILIO_MESSAGING_SERVICE_SID,Body:`Asepsis: new ${record.type === 'home' ? 'home' : 'commercial'} cleaning request ${record.id.slice(0,8)}. Check ${contact.email} for details. Appointment not confirmed.`},
  };
}
