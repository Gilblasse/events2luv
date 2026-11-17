# Recovery and review record

Reviewed November 16, 2026 (America/Chicago).

## Recovered work

The implementation was recovered from `events2luv-recovery.bundle` into a separate `recovered` checkout, preserving the original main checkout and its modified lockfiles. The full START_HERE_CODEX.md and version 3 plan were read. All archive SHA-256 checks passed, and every source snapshot file matched its recovered Git blob (Windows checkout newline conversion accounts for text working-file hash differences).

GitHub's review branch was actually queried and pointed to `bb796d6a88e597b7ce76b5dd2fe8c5e03a041a51`. A normal fast-forward push saved the original history through `5db8df59c1eaed8a58652d70c93cf891c35329f3`. A fresh independent clone from GitHub matched the entire recovered Git tree. This supersedes the earlier uncorroborated claim that a reconstructed remote commit had already saved the implementation. No force-push, main update, domain change or production deployment occurred.

Review branch: https://github.com/Gilblasse/events2luv/tree/feat/editorial-redesign . The follow-up verification commit containing this record updates dependencies and staging guidance. Consult the branch HEAD for its final SHA; the media remains identical to the recovered commit.

Remote film SHA-256: `0e3240a9e2a09840b6a999a31ce2340f5e45886b844135031815a5eab638e7bf`; Git blob `3529cc89693db9005198d237615a56a03a0fa8b5`. FFprobe confirmed H.264, 1280 x 720, 13.6 seconds, 1,743,035 bytes.

The approved `Events2Luv_Redesign_Plan.md`, version 3, was read in full. Its admin and gallery specifications were compared with the recovered source. The public domain and `main` are not deployment targets of this recovery.

The tree excludes `.eslintcache`, build output, dependencies, local paths/metadata, original download intermediates, environment secrets, SQLite databases, admin sessions, and test runtime data. Optimized website photographs, Shaniese's portrait, and the labeled photo film are included. Asset provenance is recorded in `assets/manifest.json`.

## Checks completed

- Production Vite build: passed on Windows and inside Docker.
- Automated suite on final patched code in the Node/FFmpeg container: 13 passed, 0 failed. Windows editor-only run: 3 passed (initial sandbox denial resolved with an authorized rerun).
- Docker image built successfully, including FFmpeg and production dependencies. The host lacks FFmpeg; the full suite used the container runtime.
- Local dedicated-volume check passed: saved content, media bytes and private inquiries survived replacement containers and restoration from a stopped-volume backup; SQLite integrity_check returned ok. QA containers were stopped and QA volumes retained. This is not a hosted redeploy or automated off-host-backup test.
- GitHub Actions on recovered commit `5db8df5`: passed (run 44013016503).
- Dependency audit initially found two high-severity packages. Updated Nodemailer to 10.6.0 and Sharp to 0.35.5; installation/audit now reports zero known vulnerabilities. Real SMTP delivery remains unverified.
- Made npm start portable across Windows/Linux and aligned the declared minimum Node version with the locked test dependencies (24.15+). Windows host currently has 24.13.1; use the tested container or upgrade Node for supported native testing.
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

The local development server starts at http://localhost:3000. The Playwright tool returned an approval-policy denial; the fallback browser access host was unavailable. No desktop/mobile screenshot, actual touch/keyboard browser pass, reduced-motion browser pass, physical second-device test, or hosted preview is claimed. The source includes these layouts and controls, but they still need a real browser acceptance pass.

Docker Desktop was started and the image was built and tested locally. No suitable hosted account is confirmed. The user requires all work to be free and explicitly requested retaining Node/SQLite. No purchase or paid deployment was made. See [STAGING.md](STAGING.md) for a zero-subscription local staging setup and optional free HTTPS tunnel, owner inputs, and remaining verification steps.

Before launch:

1. Connect a Node/container host with one persistent volume for SQLite and media, one application instance, and HTTPS. See README and compose.yaml. Do not deploy this app as a static GitHub Pages site or to ephemeral storage.
2. Set the staging APP_ORIGIN and trusted proxy configuration, then provision the owner's individual admin account with the included CLI. There are no default credentials.
3. Configure SMTP_URL, MAIL_FROM, and INQUIRY_TO and verify delivery at the business inbox. Consultation requests are already stored privately even without SMTP, but email delivery has not been tested.
4. Validate desktop/mobile editing, Save/Cancel, uploads, gallery motion/reduced motion, sign-out, and persistence across an actual deployment retaining the disk. Test backup restoration.
5. Confirm final service/contact copy and image permissions. The gallery uses the existing public-site collection and explicitly explains that event-specific stories await verified details; do not invent client stories.
6. Confirm the existing domain/DNS deployment source and review staging before any cutover. Keep the existing live website available until then.
