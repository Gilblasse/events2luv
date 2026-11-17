# Recovery and review record

Reviewed November 16, 2026 (America/Chicago).

## Recovered work

The existing implementation was recovered intact, not rebuilt. The local branch contained `eb860c8` (editorial website and persistent inline editor), followed by `da9fd8b` (obsolete build-cache removal). GitHub's `feat/editorial-redesign` branch still pointed to starter commit `bb796d6a88e597b7ce76b5dd2fe8c5e03a041a51` at recovery. The reviewed tree is saved to that review branch through the connected GitHub account. The local historical commits are retained locally; the remote review commit contains the complete cleaned tree atop the original main commit.

The approved `Events2Luv_Redesign_Plan.md`, version 3, was read in full. Its admin and gallery specifications were compared with the recovered source. The public domain and `main` are not deployment targets of this recovery.

The tree excludes `.eslintcache`, build output, dependencies, local paths/metadata, original download intermediates, environment secrets, SQLite databases, admin sessions, and test runtime data. Optimized website photographs, Shaniese's portrait, and the labeled photo film are included. Asset provenance is recorded in `assets/manifest.json`.

## Checks completed

- Production Vite build: passed.
- Automated suite: 13 passed, 0 failed.
- Integration coverage: protected pages/API writes, login and logout, CSRF and request origin, malicious links, stale-version conflicts, durable text/image/video saves after server restart, draft-upload privacy/cancellation/publication, corrupt-upload rejection, video conversion and range playback, private consultation requests, invalid media references, and unauthorized uploads.
- React interaction coverage: private text preview, Save, Cancel, remount persistence, Cancel after Save, shared-link preview/reversion, failed Save preserving the draft and successful retry.
- `git diff --check`: passed.

A public request without admin cookies reads the same saved content after restart. This verifies shared server persistence, not a physical second-device browser test.

## Small corrections during verification

- Enforce fields appropriate to each content type; reject missing or mismatched bundled media before saving.
- Keep touch Edit controls visible on coarse-pointer devices, with 44px minimum touch targets.
- Complete video, poster, and captions upload guidance.
- Extend Docker exclusions to cover caches and original download intermediates.

## Verification limits and launch blockers

The connected browser could not reach the workspace preview URL (connection refused). No desktop/mobile screenshot, actual touch/keyboard browser pass, reduced-motion browser pass, or working hosted preview is claimed for this recovery. The source includes responsive and reduced-motion layouts, stable editing mode, crop controls, and native video controls; they still need a browser pass on the staging host.

No Docker runtime is available here, so the Docker image itself has not been built in this workspace. The Node production build and backend were exercised by the integration suite.

Before launch:

1. Connect a Node/container host with one persistent volume for SQLite and media, one application instance, and HTTPS. See README and compose.yaml. Do not deploy this app as a static GitHub Pages site or to ephemeral storage.
2. Set the staging APP_ORIGIN and trusted proxy configuration, then provision the owner's individual admin account with the included CLI. There are no default credentials.
3. Configure SMTP_URL, MAIL_FROM, and INQUIRY_TO and verify delivery at the business inbox. Consultation requests are already stored privately even without SMTP, but email delivery has not been tested.
4. Validate desktop/mobile editing, Save/Cancel, uploads, gallery motion/reduced motion, sign-out, and persistence across an actual deployment retaining the disk. Test backup restoration.
5. Confirm final service/contact copy and image permissions. The gallery uses the existing public-site collection and explicitly explains that event-specific stories await verified details; do not invent client stories.
6. Confirm the existing domain/DNS deployment source and review staging before any cutover. Keep the existing live website available until then.
