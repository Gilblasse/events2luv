# Free staging: existing Node/SQLite application

Prepared November 16, 2026 (America/Chicago). The owner requires everything to be free. No paid hosting, subscription, purchase, or paid deployment is authorized or has been created. Preserve main and the existing live website.

## Recommendation and cost

Use the existing computer and Docker with a persistent named volume: $0 service fees. For HTTPS review on another device, optionally use a free Cloudflare Quick Tunnel. No domain purchase, Cloudflare account, or payment card is required. The computer must stay awake and online; the preview URL is temporary, with no uptime guarantee. Existing electricity/internet costs still apply. This is a staging option, not guaranteed always-on cloud hosting.

Docker Desktop is already installed. Its free license covers personal use and small businesses with fewer than 250 employees AND less than $10 million annual revenue. Do not enroll in a paid plan. See https://docs.docker.com/subscription-billing/desktop-license .

## Exact setup

These instructions have not launched a tunnel. Public sharing is optional; use test inquiries until acceptance is complete.

1. Open PowerShell in the recovered checkout, start Docker Desktop, and build:

   ```powershell
   docker build -t events2luv-staging .
   ```

2. Install the free official tunnel client if needed:

   ```powershell
   winget install --id Cloudflare.cloudflared --exact
   ```

3. In a separate terminal, start a tunnel to the intended staging port:

   ```powershell
   cloudflared tunnel --url http://localhost:3100
   ```

   Keep it running and copy its exact generated HTTPS trycloudflare.com origin. It can show an upstream error until step 4. Anyone with the URL can access the public staging pages. Optionally append `--allowed-mail CONFIRMED_OWNER_EMAIL` to restrict preview access with an email PIN (requires an interactive browser).

4. Replace the placeholder with that exact origin, without a trailing slash:

   ```powershell
   docker run -d --name events2luv-staging -p 127.0.0.1:3100:3000 -e APP_ORIGIN=https://REPLACE.trycloudflare.com -v events2luv-staging-data:/app/data events2luv-staging
   ```

   The image sets NODE_ENV=production, PORT=3000 and DATA_DIR=/app/data. Keep one instance. Leave TRUST_PROXY unset until the topology is verified; rate limits will conservatively group proxy connections. A new tunnel hostname requires recreating only the staging container with the new APP_ORIGIN and the SAME volume. Never delete the data volume or use a wildcard origin.

5. Check the HTTPS URL and `/api/health`. Provision the confirmed owner account:

   ```powershell
   docker exec -it events2luv-staging npm run admin -- CONFIRMED_OWNER_EMAIL
   ```

   Enter a unique password of at least 14 characters at the hidden prompt. Do not put passwords in Git, command arguments or chat. Use the HTTPS `/admin` address because production sessions use Secure cookies.

6. Test desktop/phone gallery motion, reduced motion, keyboard/touch, all editor types, private drafts, Save/Cancel after Save, failures, conflict handling, Preview and logout. Check saved content from a second device, then after replacing the container with its volume retained.
7. Leave SMTP unset until a free provider allowance or existing account is confirmed. Requests persist in the protected inbox without email. Set SMTP_URL, MAIL_FROM and INQUIRY_TO together only with owner-provided credentials and a verified sender, then check actual delivery. No paid mail subscription.
8. Stop the tunnel with Ctrl+C and stop the container with `docker stop events2luv-staging` after review. Keep the volume. Do not alter production DNS.

Cloudflare documentation: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ . Quick Tunnels have no uptime guarantee, a 200 in-flight request limit, and a hostname that changes on restart. No tunnel has been launched in this recovery session.

## Verification and owner inputs

The local Vite build, Docker image build, full 13-test suite, and dedicated-volume container-replacement/backup-restore check passed. SQLite integrity, saved text, media bytes and private inquiries survived restoration. The local development server runs at http://localhost:3000 while its process remains active.

Browser automation was unavailable; desktop/phone visual, keyboard, touch and reduced-motion acceptance remains outstanding. No hosted preview, owner account or real SMTP delivery is claimed.

Needed from the owner: confirmed admin email and securely chosen password; existing/free SMTP credentials and destination inbox; verified service/contact copy, image permissions and real event details. No hosting purchase or account is needed for this temporary tunnel approach. Current deployment mapping and separate cutover authorization remain prerequisites for launch.

For free backups, use existing backup storage for a consistent stopped-app copy of database and media together. Do not copy only a live site.sqlite while ignoring WAL files. Keep backups outside the public media route and restore into a separate test volume. Scheduled off-host backup automation is not configured.
