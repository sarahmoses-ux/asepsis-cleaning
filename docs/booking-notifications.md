# Activate booking notifications on Vercel

The implementation is ready for configuration. It has not sent a live email or text. Until all required settings are present and `BOOKING_NOTIFICATIONS_ENABLED=true`, the website keeps the email-draft option.

## What happens when enabled

1. The customer submits a home or commercial booking request on the website.
2. A Vercel Function validates the request, calculates any residential estimate from the server's price table, and saves the request in MongoDB.
3. Resend is asked to send the full request to the relevant business inbox:
   - Residential: `asepsiscleaningservices@gmail.com`
   - Commercial: `asepsisedmond@gmail.com`
4. Twilio is asked to send a brief SMS alert to **+1 405-549-7722**, identifying the request and which inbox to check. Customer addresses and access details are not included in the SMS.
5. The customer receives a request reference. The appointment is still subject to your team's availability confirmation; this does not reserve a calendar slot or take payment.

## Accounts to set up

### 1. Twilio for SMS

Create a [Twilio account and Messaging Service](https://www.twilio.com/docs/messaging/tutorials/send-messages-with-messaging-services), and add an eligible SMS-capable sending number to that service. Your existing **+1 405-549-7722** remains the recipient, not the Twilio sending number.

Complete Twilio's onboarding and the registration/verification required for the chosen US sending number. In particular, US application-to-person messages from a local 10DLC number require the applicable registration. A trial account alone should not be treated as a completed production setup. Twilio charges for its service; review its current pricing during account setup.

Record the Account SID, Auth Token and Messaging Service SID in Vercel, not in source code or chat.

### 2. Resend for email

Create a [Resend account](https://resend.com/docs/api-reference/emails/send-email), verify a domain you control, and create an API key. Use a sender such as `Asepsis Bookings <bookings@your-domain.com>`.

Your two Gmail addresses are the **recipients**. They are not the Resend sending domain. A shared `vercel.app` subdomain is also not a domain you can verify as your own mail sender. If you do not own a domain yet, obtain one or choose a different email integration before activation. Resend's test sender has recipient restrictions; test both business inboxes using the verified production sender.

### 3. MongoDB for saved requests

Create a MongoDB Atlas cluster or another MongoDB deployment, then add its connection string to Vercel as `MONGODB_URI`. This stores requests independently of a function invocation, tracks notification attempts and prevents duplicate alerts.

Use a production database separate from any test database. Records should be retained for a defined period and backed up according to your operational policy. Access to the database should be limited to the business's authorized administrators.

## Vercel settings

In **Project → Settings → Environment Variables**, add the following to **Production**. Use `.env.example` as the template. None of the secrets may have a `VITE_` prefix: that prefix would make them available to browser code.

| Name | Value |
| --- | --- |
| `SITE_URL` | Your exact canonical production origin, e.g. `https://www.your-domain.com`, matching where customers submit the form |
| `RESEND_API_KEY` | Resend API key |
| `BOOKING_FROM_EMAIL` | Your verified sending address, optionally with a display name |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_MESSAGING_SERVICE_SID` | Messaging Service SID with an approved sender |
| `ADDITIONAL_SMS_RECIPIENTS` | Optional additional business alert numbers, comma-separated in international format. The original +14055497722 remains included. |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Optional database name, defaults to `asepsis` |
| `CRON_SECRET` | A randomly generated secret of at least 32 characters |
| `BOOKING_NOTIFICATIONS_ENABLED` | `true` when all services are configured |

Deploy the repository changes and redeploy after changing variables. The project remains a Vite application; files in `api/` become Vercel Functions. No custom SPA rewrite should intercept `/api/*`. Hash page URLs do not require an SPA rewrite. See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [Vercel environment variables](https://vercel.com/docs/environment-variables).

Each SMS recipient has its own saved delivery status and provider ID. A retry for one failed recipient does not resend alerts already accepted for another recipient. Recipients are fixed when a request is created; changing the list affects new requests. Removed recipients will not receive new attempts. The additional Nigerian recipient has been confirmed and saved privately in the git-ignored `.env.local` file. Copy its `ADDITIONAL_SMS_RECIPIENTS` setting into Vercel's Production environment when activating notifications. Do not add this private number to public site configuration, frontend code, example environment files or tracked documentation. This setting is server-only and must never have a `VITE_` prefix.

Production secrets should not be set for preview deployments. If testing a preview integration, use isolated test credentials, database and origin. Normal `npm run dev` serves only the frontend; it falls back to email without a local function server. Browser tests mock `/api/bookings`. Use the Vercel CLI's local development environment if you need to exercise real functions locally.

## Test activation

1. Check that `/api/bookings` returns `{"enabled":true}`. This confirms configuration presence, **not** provider credential validity.
2. Submit one clearly labelled test residential request. Confirm a record appears in MongoDB, the email reaches the residential inbox and an SMS reaches the business phone.
3. Submit one commercial test and confirm it reaches the commercial inbox and the same phone.
4. Check Resend and Twilio delivery dashboards. An API-accepted message can still bounce or fail later at the destination; this implementation records provider acceptance and IDs, not later delivery receipts. Provider dashboards are the authority for final delivery status.
5. Check that the website displays a request reference and does not claim an appointment has been confirmed.

Do not consider alerts live until the two delivery tests pass. The automated tests use mocked providers and do not send anything or incur messaging charges.

## Failed notifications and recovery

- Every request is saved before notification dispatch. A failed email or SMS does not discard the booking request or make the customer submit it again.
- Booking records are stored in MongoDB keyed by the request ID. Records include separate email/SMS states and provider IDs. Look up the short reference in the booking collection in the secured MongoDB console.
- Provider acceptance is recorded as `accepted`; it is not a guarantee of inbox/handset delivery.
- Explicit HTTP 429 rejections remain queued for up to three attempts. Pending requests interrupted before sending are also picked up by the retry endpoint.
- `vercel.json` includes a **daily 15:00 UTC** backstop at `/api/retry-notifications`. It processes up to two pending requests per run. Vercel's Hobby cron timing may be delayed; it is not a real-time delivery guarantee. Review [Vercel's cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) before increasing frequency. Normal alerts are attempted immediately during submission.
- An administrator can invoke the same GET endpoint using `Authorization: Bearer <CRON_SECRET>` to process another batch. Never put this secret in a URL or public browser code.
- Timeouts, interrupted sends and ambiguous provider responses are marked `uncertain`. They are **not** blindly retried, because a provider may already have accepted the message. Definitive non-rate-limit provider errors are marked `failed`.
- Watch Vercel logs for `Notification needs attention` / `Notification needs review`, then inspect the record and provider dashboards. Logs contain references and states, not customer contact details or credentials. If a delivery needs manual follow-up, contact the customer from the saved record; do not ask them to submit again. After confirming no delivery took place and fixing the cause, an administrator may reset that channel to `pending` with `attempts: 0` and re-add the request ID to `asepsis:notification-queue` in Redis.
- Duplicate submissions reuse a UUID and cannot create a second record with the same ID. Altered payloads with a reused ID are rejected. The browser retains its retry ID while the page is open; refreshing or starting a new request creates a new ID.
- Cost guardrails limit new requests to five per IP window (one hour) and fifty per global window (24 hours). Existing IDs are not counted twice. Windows start with the first accepted request. Requests over those limits show a call/email alternative. These limits help bound abuse but do not replace monitoring or Vercel firewall rules.

The API validates origin and fields; it never lets a visitor supply the alert destination. Email goes only to the configured business inboxes and SMS only to the business phone. No customer confirmation email or customer SMS campaign is sent by this integration.
