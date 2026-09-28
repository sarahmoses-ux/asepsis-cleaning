import bookingHandler from '../api/bookings.js';
import retryHandler from '../api/retry-notifications.js';

export function createApiRouter({ bookings = bookingHandler, retry = retryHandler } = {}) {
  return async function route(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname;
    const handler = path === '/api/bookings' ? bookings : path === '/api/retry-notifications' ? retry : null;
    if (!handler) return false;
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
    try {
      if (req.method === 'POST') {
        const chunks = [];
        let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 16000) { res.status(413).json({ error: 'Your request is too long. Please shorten the notes.' }); return true; }
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
