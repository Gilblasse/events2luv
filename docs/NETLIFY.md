# Netlify deployment status and checklist

Migration branch: `deploy/netlify-free`. Existing `main` and events2luv.com are unchanged.

## Cost controls

The owner requires $0 hosting. The Netlify team was switched from Legacy Starter to Free (300 shared credits/month, no hosting overage charges). All team projects share the cap and may pause if exhausted. Existing domain registration/renewal is separate. Do not enable paid services or auto-recharge.

## Application migration

- React/Vite design is retained. `netlify.toml` builds static pages and routes API/media to a Node function.
- Netlify Database (`@netlify/database`, `NETLIFY_DB_URL`) stores content, revisions, admin accounts, sessions, inquiry inbox and shared rate limits. The schema is created on first database use. Database must be provisioned through Netlify before functional testing.
- Netlify Blobs stores media in 2 MiB pieces. Authenticated chunk uploads preserve the 15 MiB image and 100 MiB video input limits while avoiding a single oversized function request. Processed images must fit 2 MiB; the editor reports a resize request if necessary.
- FFmpeg and FFprobe are bundled. Hosted video processing is capped at 35 seconds; complex videos may need compression before upload. Full production-size video processing still requires hosted acceptance tests.
- Save checks versions and atomically publishes media records with the content transaction. Cancel deletes only private media. Public byte-range reads are bounded to 2 MiB for videos.
- SQLite and filesystem media remain available for the existing local/Docker workflow.

## Finish deployment

1. GitHub authorization and project creation are complete: `events2luv` imports `deploy/netlify-free` at https://app.netlify.com/projects/events2luv. The first hosted build exposed a legacy Lambda/CJS bundling error; the native Functions wrapper and production-only server build resolve it in local packaging validation.
2. Retain repository build settings; do not set NODE_ENV=production for dependency installation, because Vite is a build-time dependency.
3. Netlify Database was automatically provisioned. Verify its environment is available to functions. No existing production SQLite records were migrated; none were provided in this workspace.
4. Set the project function origin explicitly if required. The handler uses Netlify's DEPLOY_PRIME_URL/URL. Do not put database connection strings or admin passwords in Git.
5. Provision the first admin by setting `E2L_ADMIN_EMAIL` and `E2L_ADMIN_PASSWORD` in Netlify's environment settings, then deploy. The password must be 14–256 characters. The build stores only its salted scrypt hash; it never resets an existing admin. Remove both bootstrap variables after successful creation and deploy again. The owner should enter their password directly in Netlify, never in Git or chat. The existing `scripts/admin.mjs` CLI remains available in an authenticated database environment.
6. Test the generated HTTPS URL: all public routes, admin authentication, CSRF, Save/Cancel, conflicting edits, private uploads, published images, captions, video range playback, inquiry submission and inbox.
7. Redeploy and verify saved changes, media, inquiry inbox and admin access survive.
8. Only after acceptance, merge the migration, configure the project's production branch as main, add events2luv.com, and change DNS to the exact records Netlify provides. Preserve mail-related DNS records.

## Validation completed locally

Production Vite build passes. Fifteen tests pass: the original 13 UI/integration checks plus PostgreSQL adapter and bounded media-range/cleanup tests. PostgreSQL SQL is exercised with PGlite; the advisory-lock path and real Netlify services still require hosted verification. No deployment success is claimed before those checks pass.

## Outstanding hardening before production

- Validate the real function bundle against Netlify's size/time limits and test a representative full-size upload.
- Provide cleanup of expired unfinished upload chunks and rate-limit entries (currently not automatically removed).
- Verify public-content CDN caching and cache purge after Save on the hosted site. Public content now uses a one-day durable cache; private admin content remains uncached. This prevents ordinary page visits from continually waking PostgreSQL.
- Verify inquiry email delivery separately if SMTP notifications are configured. The saved inbox works independently of SMTP.
