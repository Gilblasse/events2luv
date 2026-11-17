# Events2Luv — The Editorial Story

A complete React/Vite site with a Node 24/Express backend, durable SQLite content and inquiry storage, and private-to-public media uploads. The refinement is on `feat/immersive-story-refinement`, based on `feat/editorial-redesign`; it does not change the existing live domain automatically. See [the refinement review](docs/REFINEMENT_REVIEW.md) for before/after screenshots, test results, Lighthouse measurements and photography gaps.

## Included

- Homepage, Services, About, FAQs, editorial Gallery and consultation Booking page.
- GSAP/ScrollTrigger Spark → Details → Moment sequences on Home and Gallery, distinct compositions, separated caption timing, direct chapter navigation and an accessible lightbox.
- Stacked mobile and reduced-motion gallery, keyboard controls, and focus-managed editing dialogs.
- Optimized real photographs recovered from the existing website; original source URLs and provenance in `assets/manifest.json`.
- The original silent photo montage is retained in the admin archive and All content, with playback controls and editable poster/captions; it is no longer repeated in the public gallery. No invented client events or paid AI generation.
- Individual admin accounts, inline text/link/image/video editing, all-content search, crop controls including mobile focal points, poster/caption uploads, immediate private draft preview, Save and Cancel.
- Version checks prevent lost updates; previous saved revisions remain in the database. Uploaded replacements stay private until a successful save. Cancel deletes uncommitted uploads without deleting published files.
- Consultation requests are durably stored in the admin Requests inbox. Optional SMTP notifications are separate from storage.

## Run locally

Requirements: Node **24.15+** (latest Node 24 LTS recommended), npm, FFmpeg/FFprobe on PATH. The container includes these requirements; Windows users can use Docker for the full integration suite.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. A development server reload is needed after server-side changes.

Provision each admin explicitly; the CLI prompts for a hidden password of at least 14 characters:

```bash
npm run admin -- your-admin@example.com
```

Visit `/admin`. The same command rotates an existing account's password and revokes its sessions. There are no shipped default credentials, public signup, or browser-only permission checks.

## Check

```bash
npm run build
npm test
```

Integration checks cover authentication, authorization/CSRF, malicious links, concurrent edits, persistence after restart, private uploads/cancellation/publication, video transcoding and range playback, private consultation requests, and logout. Editor tests exercise Save/Cancel and shared-link preview behavior.

## Deploy

See [the free staging setup guide](docs/STAGING.md) for persistent local Docker storage, an optional free HTTPS preview tunnel, and acceptance checks. The owner requires $0 service fees. No hosting purchase or live-domain cutover has been made.

**GitHub Pages cannot run this backend.** Deploy the included Docker image on a Node/container host with one persistent disk and an HTTPS reverse proxy. Use one application instance; SQLite, local uploads, and in-memory rate limits are intentionally a simple single-instance architecture. Do not use an ephemeral filesystem or multiple independent replicas.

```bash
cp .env.example .env
# Set APP_ORIGIN to the exact HTTPS origin, without a trailing slash.
docker compose up --build -d
docker compose exec website npm run admin -- your-admin@example.com
```

The Compose configuration binds only `127.0.0.1:3000`. Point an HTTPS reverse proxy at that address. Set `TRUST_PROXY` only for the actual trusted proxy network/topology. Keep the named `events2luv-data` volume across deployments. Never run `docker compose down -v` on production unless you intend to erase its data.

Required production configuration:

| Setting       | Purpose                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `APP_ORIGIN`  | Exact public HTTPS origin used for request-origin checks                              |
| `DATA_DIR`    | Persistent directory containing SQLite and uploaded media; Docker default `/app/data` |
| `PORT`        | Listener, default 3000                                                                |
| `TRUST_PROXY` | Optional trusted proxy range for correct client-IP rate limiting                      |
| `SMTP_URL`    | Optional SMTP transport connection string; keep secret                                |
| `MAIL_FROM`   | Verified sender used by the mail provider                                             |
| `INQUIRY_TO`  | Notification recipient; proposed business inbox `events2luv@gmail.com`                |

Configure all three mail settings together to enable notifications. A mail failure never loses the request; it remains in the admin inbox. Verify a test notification at the actual business inbox before launch. No live SMTP credentials are included or configured by this build.

The server exposes `/api/health`. Production sessions use Secure, HttpOnly, SameSite=Strict cookies. Do not place it directly on plain HTTP.

## Media and editing

Images: JPG/PNG/WebP, up to 15 MB and 40 megapixels. They are decoded, orientation-corrected, resized within 3000×3000, and re-encoded as WebP. Videos: MP4/WebM, up to 100 MB, 5 minutes, 4096 pixels per dimension; validated with FFprobe and transcoded to H.264/AAC MP4 within 1920×1080. One video is processed at a time to bound server resource use. Captions: valid WebVTT header, up to 1 MB. Upload routes require an admin session and CSRF token.

Each editor shows its slot's recommended dimensions. Recommended resolution is guidance rather than a hard rejection threshold. New content overrides are in SQLite; builds never overwrite them. `src/content.js` holds the initial defaults and stable block IDs. Changing an ID after launch would disconnect its saved override, so preserve IDs.

The “All content” panel exposes copy that isn't directly visible, including placeholders, chapter controls, form error copy and shared links. Save intentionally updates the public site immediately. Cancel affects only the current unsaved draft. No raw HTML is accepted.

## Backups and recovery

Back up the complete persistent data directory (database and media together). Stop the application briefly for a consistent filesystem copy, or use a SQLite-aware online backup with matching media backup. Keep encrypted off-host backups and test restoration. Revisions record prior values, editor and save time; a developer can recover a value from that table and save it through the editor. Published media is retained for recovery.

## Before moving the public domain

1. Select a server/container host and persistent storage; the repository is not tied to a paid hosting account.
2. Set the HTTPS origin, provision the owner's admin account, and test access.
3. Configure and verify consultation email delivery; the admin inbox already works without email.
4. Confirm the business's image permissions, service copy, real event stories, and booking process. Existing public-site images are reused, not independently rights-cleared.
5. Confirm the current domain's deployment/DNS source before replacing it. The GitHub repository previously contained a starter app that differed from the live site.
6. Exercise the public pages on real mobile devices and test admin editing on the production host; verify a saved edit survives a redeploy with the persistent disk retained.

No domain/DNS change, paid-host subscription, or production admin credential is part of this commit.
