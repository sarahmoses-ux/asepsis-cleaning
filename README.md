# Asepsis Edmond — React website

Run `npm install`, then `npm run dev`. Open the local URL printed by Vite. `npm run build` creates the production site in `dist`; `npm run preview` previews that build. Run `npm test` for unit and backend checks. Run `npm run test:browser` with the dev server running for browser checks.

The original `.dc.html` designs are organized in `references/designs/`, alongside their supporting scripts and assets. The React entry point remains at `index.html`. The React version uses the original designs' cream, serif, rounded-card visual direction, the provided logo, and the September 2026 brand-kit pricing. Pages include home, residential pricing, builders/businesses, blog and individual articles, photo gallery, customer reviews, about, FAQs and quote requests. Hash navigation supports browser back/forward and static hosting without rewrite rules.

Blog content and the Monday/Thursday release queue are in `content/blog.json`. See [the publishing guide](content/README.md) for scheduling, adding articles, gallery photos and genuine reviews. Eight initial posts cover September 28–October 22, 2026; ongoing publishing requires replenishing the approved queue. Scheduled visibility works in the browser for content already included in a deployed build.

Residential and commercial enquiries, booking alerts and payment alerts all use `asepsisedmond@gmail.com`. Contact configuration lives in `shared/site-config.js`. The public business location is Oklahoma; the street address has been removed from live pages and map links.

Booking requests can be submitted through the API, saved in MongoDB, and emailed to the appropriate business inbox through Resend. Email works independently of SMS. Set `BOOKING_SMS_ENABLED=true` only when Twilio is ready to send optional SMS alerts. Follow [the activation guide](docs/booking-notifications.md) to configure the accounts and server-only environment variables. Booking stays on the website: saved requests open a review and payment page. If the backend is unavailable, the form shows an error and retains the details. Residential first-visit card checkout is optional; commercial projects wait for a quote. See [payment setup](docs/booking-payments.md) for Render connection and Stripe activation. The team confirms appointment availability.

Before publishing: verify current rates, insurance and availability claims with the business owner; supply any desired confirmed review content, payment and cancellation policies; connect the live domain and booking service. Unverified testimonials, draft guarantees, example business hours and placeholder Google reservation links have been omitted.

Illustrative interior photographs are stored in `public/photos`; they are not represented as actual customer work. Photo source URLs: Unsplash images `photo-1556912172-45b7abe8b7e1` (kitchen), `photo-1620626011761-996317b8d101` (bathroom), and `photo-1600210492486-724fe5c67fb0` (living room).

## Project structure

```text
api/                 Vercel HTTP endpoints
backend/             Server, database, validation and notification services
content/             Blog content and publishing guide
docs/                Setup and operations documentation
public/              Live images served directly by Vite
references/          Original materials, excluded from deployment
  assets/            Original logo assets
  brand/             Brand kit and supplied images
  designs/           Original HTML designs and their supporting assets
shared/              Pricing and contact configuration used by frontend and backend
src/
  main.jsx           React entry point
  App.jsx            Main application and core site pages
  hooks/             Booking request hook
  lib/               Content utilities and gallery/review data
  pages/             Quote form, booking review and community pages
  styles/            Site stylesheets
tests/
  unit/              Unit and backend integration tests
  e2e/               Playwright browser tests
```

Keep server secrets in the ignored environment files at the project root. Run `npm run dev:backend` alongside `npm run dev` to use the local booking API. Root configuration files are kept in place for Vite, Vercel, npm and Playwright.


The homepage uses a dedicated `src/pages/Home.jsx` and `src/styles/home.css`, with scroll entrance animations, reduced-motion support and a keyboard-accessible room preview. `public/photos/home-hero-v2.jpg` and `cleaning-detail-v2.jpg` are optimized AI-generated illustrative images, not customer properties or staff photographs. Original PNGs are archived in `references/brand/website-imagery/` and excluded from deployment.
