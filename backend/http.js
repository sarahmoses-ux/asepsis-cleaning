import bookingHandler from '../api/bookings.js';
import retryHandler from '../api/retry-notifications.js';
import checkoutHandler from '../api/checkout.js';
import webhookHandler from '../api/payment-webhook.js';

export function createApiRouter({ bookings = bookingHandler, retry = retryHandler, checkout = checkoutHandler, webhook = webhookHandler, env = process.env } = {}) {
  return async function route(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname;
    const handler = path === '/api/bookings' ? bookings : path === '/api/retry-notifications' ? retry : path === '/api/checkout' ? checkout : path === '/api/payment-webhook' ? webhook : null;
    if (!handler) return false;
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
    if(path !== '/api/payment-webhook' && path !== '/api/retry-notifications') {
      res.setHeader('Vary','Origin');
      let origin;
      try { origin = new URL(env.SITE_URL).origin; } catch { /* Configuration errors are handled by the endpoint. */ }
      if(req.headers.origin && req.headers.origin === origin) {
        res.setHeader('Access-Control-Allow-Origin',origin);
        res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
      }
      if(req.method==='OPTIONS') { res.status(req.headers.origin===origin && origin ? 204 : 403).end(); return true; }
    }
    try {
      if (req.method === 'POST') {
        const chunks = [];
        let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > (path==='/api/payment-webhook'?65536:16000)) { res.status(413).json({ error: 'Your request is too long. Please shorten the notes.' }); return true; }
          chunks.push(chunk);
        }
        req.body = Buffer.concat(chunks).toString('utf8');
      }
      await handler(req, res);
    } catch {
      if (!res.headersSent) res.status(503).json({ error: 'Request service unavailable. Please retry.' });
      else res.end();
    }
    return true;
  };
}
