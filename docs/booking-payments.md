# Booking review and payments

Customers complete the quote form, submit it to `/api/bookings`, and continue to `#/booking-review` only after the backend confirms persistence. There is no email-draft booking fallback. Errors preserve the form and retries reuse the request ID. Business notification emails still run after a request is saved.

The review page displays the server-calculated first-visit estimate and the submitted details. Residential customers pay that first-visit estimate in USD as a one-time payment. Recurring cleans start with the deep-clean rate; later visits are shown separately and are not automatically charged. Commercial requests wait for an agreed quote and cannot create a payment session. Appointment availability still requires team confirmation.

## Current activation state

The integration uses Stripe's embedded Checkout. Payments are off by default. Without a configured merchant account, customers can save and review requests but see that online payment is unavailable and no payment has been taken. No real charge has been tested as part of this implementation.

Before enabling Stripe, confirm merchant eligibility for the actual business and account owner using [Stripe's supported countries](https://stripe.com/global). Do not register under someone else's identity or assume the developer's country and business country are interchangeable.

## Render backend and separate frontend

- Backend root directory: repository root (leave Render's field blank).
- Backend build: `npm ci`; start: `npm start`.
- Set the booking/email variables described in `booking-notifications.md` on Render.
- Set backend `SITE_URL` to the exact frontend origin, including HTTPS and whether it uses `www`. Only that origin is allowed to submit and make cross-origin browser requests.
- Set `VITE_API_BASE_URL` on the frontend host to the Render backend origin, for example `https://your-backend.onrender.com`, then rebuild the frontend. It is public configuration, not a secret. Do not append `/api`.
- Local development uses the Vite proxy and `http://127.0.0.1:5173` as `SITE_URL`.

## Connect Stripe in test mode first

Set these privately on the backend:

```env
PAYMENTS_ENABLED=true
STRIPE_SECRET_KEY=your_test_secret_key
STRIPE_PUBLISHABLE_KEY=your_test_publishable_key
STRIPE_WEBHOOK_SECRET=your_endpoint_signing_secret
```

Keep `CRON_SECRET` configured: it also signs the 24-hour booking access token. Do not expose it to the frontend. The API returns only the publishable key and a checkout client secret to the authorized booking browser.

Register `https://YOUR-BACKEND/api/payment-webhook` in Stripe for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. The endpoint verifies the signature over the raw request body before storing payment status. Stripe retries failed webhook handling. For local testing, forward Stripe CLI webhooks to `http://127.0.0.1:4000/api/payment-webhook` and use the CLI-provided signing secret.

Checkout is embedded on the review page, uses card payments, and does not redirect to email or a Stripe-hosted checkout page. Card authentication may still be required by the card issuer. Card data goes to Stripe, not MongoDB or the Asepsis API.

## Verification before taking live payments

1. Submit a residential test request. Confirm MongoDB persistence and the review-page reference.
2. Check a recurring request charges the first deep-clean amount, not the ongoing maintenance price.
3. Complete a Stripe test payment and verify `payment.status=paid` and the matching session, currency and amount in MongoDB.
4. Test a declined card, repeated payment-button clicks, refresh, webhook redelivery and closing the tab during payment.
5. Confirm commercial requests display quote-first messaging without creating a checkout session.
6. Switch to live credentials and the matching live webhook secret only after merchant setup and the test-mode delivery checks succeed.

The server trusts saved prices, never browser totals or a success URL. Only a verified paid Stripe session with matching booking metadata, amount and currency can mark payment paid. Repeated checkout calls reuse the saved session and Stripe idempotency key. Expired sessions and old uncertain attempts require team review instead of silently creating a second charge.

Review details and the access token are stored in session storage for up to 24 hours, enabling reload in the same browser tab. They are not put in URLs. Someone opening the review link in another browser sees a start/help screen. Customers should contact the team with their reference rather than creating another booking after an uncertain payment.

## Business notifications

A saved request sends the existing booking email. A verified payment sends a separate **Payment received** email to the shared business inbox, `asepsisedmond@gmail.com`. It includes the amount, customer contact details, property, preferred date and booking/payment references. A booking email alone does not mean the customer paid.

Payment status and the pending payment-email state are written together in MongoDB. Stripe webhook redeliveries and browser status checks reuse that state and do not reset accepted alerts. Request and payment emails have distinct Resend idempotency keys. Failed email delivery does not roll back a successful payment. Rate-limited sends remain queued for up to three attempts; ambiguous sends and definitive failures are flagged for review rather than blindly resent.

The standalone Render backend checks queued notifications every 60 seconds while running. A sleeping or stopped service resumes recovery when it runs again; it does not provide continuous background processing while asleep. The protected `/api/retry-notifications` endpoint also handles payment alerts. Vercel retains its configured cron backstop. Provider acceptance is not final inbox delivery; check Resend delivery events when troubleshooting.

Keep `RESEND_API_KEY` and `BOOKING_FROM_EMAIL` configured along with the Stripe credentials. Payments are not considered configured without them. Payment notifications are email-only; SMS remains dependent on separate Twilio setup.
