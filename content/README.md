# Blog publishing

The initial queue contains eight finished articles, covering September 28–October 22, 2026. The launch article is available September 28; subsequent posts release Mondays and Thursdays at 9 a.m. in Oklahoma (`America/Chicago`). Dates include their UTC offset: use `-05:00` during daylight saving time and `-06:00` during standard time.

Edit `content/blog.json` to manage the queue:

1. Add a unique URL-safe `slug`, title, excerpt, category, image, image alt text, reading time and article sections.
2. Write and review the article with `status: "draft"`.
3. Set `publishAt` to its Monday or Thursday release timestamp.
4. Change `status` to `approved` when it is ready for automatic release.
5. Build and deploy the updated website so the new queue is included.

The current queue is marked ready for release. Keep at least two approved articles per upcoming week. The site does not generate new articles itself, and the initial queue ends October 22. Further writing and approval are needed for an ongoing schedule.

Approved articles are included in the static site build and become visible when their release time arrives. No redeployment or open admin session is needed for posts already in the deployed queue. Visitors' browsers check the time when the page loads, regains focus and every 30 seconds. This is a client-side publishing schedule, not a server cron service; an incorrect device clock may affect visibility, and future approved article text is present in the downloaded application bundle. Keep confidential drafts outside this repository/build. For server-controlled publishing, connect a CMS or publishing backend.

# Gallery and reviews

Edit `galleryPhotos` and `reviews` in `src/lib/content.js`. Current photos are illustrative stock interiors and are labelled accordingly. Add customer-approved project photography with accurate captions before presenting it as completed work.

Reviews must be genuine, permissioned feedback. Entries use `id`, `text`, `name`, `service` and a real `sourceUrl`. The public feedback form creates an email for the visitor to send. It does not automatically save submissions or publish reviews. Publishing consent is optional and unchecked by default.

# Contact routing

`shared/site-config.js` is the source of truth:

- Residential: Asepsis Cleaning Services — asepsiscleaningservices@gmail.com
- Commercial: Asepsis Edmond — asepsisedmond@gmail.com
- Public location: Location: Oklahoma

The archived design exports and source brand kit are historical reference materials, not part of the built website. They retain original source information; the public pages and public assets do not expose the former business address.
