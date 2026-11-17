import { db, passwordHash } from "../server/store.mjs";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error(
    "Usage: npm run admin -- admin@example.com (password is read from stdin)",
  );
  process.exit(1);
}
if (process.stdin.isTTY) {
  console.error("Enter a password (hidden), then press Enter:");
  process.stdin.setRawMode(true);
}
let password = "";
for await (const chunk of process.stdin) {
  for (const c of chunk.toString()) {
    if (c === "\u0003") process.exit(1);
    if (c === "\r" || c === "\n") {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      if (password.length < 14) {
        console.error("Use at least 14 characters.");
        process.exit(1);
      }
      await db.prepare(
        "INSERT INTO admins VALUES(?,?) ON CONFLICT(email) DO UPDATE SET password=excluded.password",
      ).run(email, passwordHash(password));
      await db.prepare("DELETE FROM sessions WHERE email=?").run(email);
      console.log("Admin account saved. Existing sessions revoked.");
      process.exit(0);
    } else if (c === "\u007f") password = password.slice(0, -1);
    else password += c;
  }
}
console.error("No password supplied.");
process.exit(1);
