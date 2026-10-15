# Admin access

The login page is available at `/admin/login` and `/#/admin`. The protected dashboard shows the latest 100 booking requests from the existing MongoDB database.

Configure these server-only environment variables on the backend host (or Vercel when using its API functions):

- `ADMIN_EMAIL`: the administrator email.
- `ADMIN_PASSWORD_HASH`: a scrypt hash in `salt:hash` format from `passwordHash` in `backend/admin.js`.
- `ADMIN_SESSION_SECRET`: a cryptographically random secret of at least 32 characters.
- `SITE_URL`: the exact frontend origin, e.g. `https://asepsisedmond.com`.
- Existing `MONGODB_URI`/`MONGO_URI` and database settings.

Never use `VITE_` prefixes for these secrets. Generate the hash locally without placing the password in shell history: run `node scripts/admin-password.mjs` and enter the password at the hidden prompt. Store only the resulting hash on the host. Generate the session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

Sign-in attempts are limited in MongoDB to five per IP per 15-minute time window. Tokens expire after 30 minutes and stay only in React memory; reloading or signing out clears browser access. To revoke all issued sessions immediately, rotate `ADMIN_SESSION_SECRET`. To reset the password, replace the hash and rotate the secret. No public account creation or email reset flow is enabled.

If the frontend and backend are on separate hosts, retain `VITE_API_BASE_URL` pointing to the backend and set `SITE_URL` there to the frontend origin. The existing backend router handles `/api/admin`. Deploy frontend and backend changes together. Vercel rewrites `/admin` and its subpaths to the React app; other static hosts need the equivalent SPA fallback.

