# Asepsis Edmond — React website

Run `npm install`, then `npm run dev`. Open the local URL printed by Vite. `npm run build` creates the production site in `dist`; `npm run preview` previews that build. Run `npm test` for pricing checks.

The original `.dc.html` designs are organized in `reference-designs/`, alongside their supporting scripts and assets. The React entry point remains at `index.html`. The React version uses the original designs' cream, serif, rounded-card visual direction, the provided logo, and the September 2026 brand-kit pricing. Pages include home, residential pricing, builders/businesses, blog and individual articles, photo gallery, customer reviews, about, FAQs and quote requests. Hash navigation supports browser back/forward and static hosting without rewrite rules.

Blog content and the Monday/Thursday release queue are in `content/blog.json`. See [the publishing guide](content/README.md) for scheduling, adding articles, gallery photos and genuine reviews. Eight initial posts cover September 28–October 22, 2026; ongoing publishing requires replenishing the approved queue. Scheduled visibility works in the browser for content already included in a deployed build.

Residential enquiries use `asepsiscleaningservices@gmail.com`; commercial enquiries use `asepsisedmond@gmail.com`. Contact configuration lives in `src/site-config.js`. The public business location is Oklahoma; the street address has been removed from live pages and map links.

Booking requests can now be submitted through a Vercel Function, saved in MongoDB, and notified to the appropriate business inbox through Resend and to +1 405-549-7722 through Twilio. Follow [the activation guide](docs/booking-notifications.md) to configure the accounts and server-only environment variables. Until configured, the existing email-draft flow remains available. Neither flow takes payment or reserves an appointment; the team confirms availability. Visitors may send plans/photos separately by email.

Before publishing: verify current rates, insurance and availability claims with the business owner; supply any desired confirmed review content, payment and cancellation policies; connect the live domain and booking service. Unverified testimonials, draft guarantees, example business hours and placeholder Google reservation links have been omitted.

Illustrative interior photographs are stored in `public/photos`; they are not represented as actual customer work. Photo source URLs: Unsplash images `photo-1556912172-45b7abe8b7e1` (kitchen), `photo-1620626011761-996317b8d101` (bathroom), and `photo-1600210492486-724fe5c67fb0` (living room).
