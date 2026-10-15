import { createStore } from '../backend/store.js';
import { issueSession, validSession, passwordMatches, loginLimitKey } from '../backend/admin.js';

export function createAdminHandler({ env = process.env, storeFactory = createStore } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH || (env.ADMIN_SESSION_SECRET || '').length < 32) {
      return res.status(503).json({ error: 'Admin access has not been configured. Please contact the site owner.' });
    }
    try {
      if (req.method === 'GET') {
        if (!validSession((req.headers.authorization || '').replace(/^Bearer /, ''), env)) return res.status(401).json({ error: 'Please sign in to continue.' });
        const bookings = await storeFactory(env).listAdminBookings();
        return res.status(200).json({ bookings });
      }
      if (req.headers.origin !== new URL(env.SITE_URL).origin) return res.status(403).json({ error: 'Please sign in from the Asepsis website.' });
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'JSON required.' });
      let body;
      try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: 'Invalid request.' }); }
      if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || body.password.length > 256 || body.email.length > 254) return res.status(400).json({ error: 'Enter your email and password.' });
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      if (!await storeFactory(env).allowAdminLogin(loginLimitKey(ip))) return res.status(429).json({ error: 'Too many sign-in attempts. Please try again in 15 minutes.' });
      const matched = passwordMatches(body.password, env.ADMIN_PASSWORD_HASH);
      if (!matched || body.email.trim().toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return res.status(401).json({ error: 'Email or password is incorrect.' });
      return res.status(200).json({ token: issueSession(env), expiresIn: 1800 });
    } catch { return res.status(503).json({ error: 'Admin service is unavailable. Please try again shortly.' }); }
  };
}
export default createAdminHandler();
