import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "events2luv-browser-"));
const env = {
  ...process.env,
  DATA_DIR: dir,
  NODE_ENV: "production",
  PORT: "4400",
  APP_ORIGIN: "http://localhost:4400",
  SMTP_URL: "",
  MAIL_FROM: "",
  INQUIRY_TO: "",
};
const account = spawn(
  process.execPath,
  ["scripts/admin.mjs", "browser@example.test"],
  { env, stdio: ["pipe", "inherit", "inherit"] },
);
// Isolated disposable fixture, never an account in the user's data directory.
account.stdin.end("Browser-test-only-748293!\n");
if (await new Promise((r) => account.on("exit", r)))
  throw Error("Could not create test account");
const server = spawn(process.execPath, ["server/index.mjs"], {
  env,
  stdio: "inherit",
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.kill();
  await new Promise((r) => server.once("exit", r));
  await rm(dir, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
