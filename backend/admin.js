import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password, hash) {
  try {
    const [salt, expected] = hash.split(':');
    const actual = passwordHash(password, salt).split(':')[1];
    const buffer = Buffer.from(expected, 'hex');
    return buffer.length === 64 && timingSafeEqual(Buffer.from(actual, 'hex'), buffer);
  } catch { return false; }
}
export function issueSession(env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ email: env.ADMIN_EMAIL, exp: now + 30 * 60_000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', env.ADMIN_SESSION_SECRET).update(payload).digest('base64url')}`;
}
export function validSession(token, env, now = Date.now()) {
  try {
    const [payload, signature] = token.split('.');
    const expected = createHmac('sha256', env.ADMIN_SESSION_SECRET).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url'));
    return data.email === env.ADMIN_EMAIL && data.exp > now && data.exp <= now + 30 * 60_000;
  } catch { return false; }
}
export function loginLimitKey(ip) {
  return `admin:${createHash('sha256').update(ip).digest('hex')}`;
}
