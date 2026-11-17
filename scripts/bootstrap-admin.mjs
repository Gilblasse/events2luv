import { db } from '../server/postgres-store.mjs';
import { passwordHash } from '../server/password.mjs';

// Set these in Netlify's environment settings, then remove after the first account exists.
const email = process.env.E2L_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.E2L_ADMIN_PASSWORD;
if (email || password) {
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 14 || password.length > 256)
    throw new Error('Initial admin setup needs a valid E2L_ADMIN_EMAIL and E2L_ADMIN_PASSWORD of 14–256 characters.');
  // One atomic statement: bootstrap never replaces or resets an existing admin.
  const result = await db.prepare(`INSERT INTO admins(email,password)
    SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM admins)
    ON CONFLICT(email) DO NOTHING RETURNING email`).run(email,passwordHash(password));
  console.log(result.rowCount ? 'Initial admin account created.' : 'Admin account already exists; bootstrap skipped.');
}
