import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
const run = promisify(execFile),
  dir = await mkdtemp(join(tmpdir(), "events2luv-test-")),
  origin = "http://127.0.0.1:4399";
let child, cookie, csrf;
const env = {
  ...process.env,
  DATA_DIR: dir,
  NODE_ENV: "production",
  PORT: "4399",
  APP_ORIGIN: origin,
  SMTP_URL: "",
  MAIL_FROM: "",
  INQUIRY_TO: "",
};
async function start() {
  child = spawn(process.execPath, ["server/index.mjs"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stderr.on("data", (d) => (log += d));
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Server did not start: " + log);
}
async function stop() {
  if (!child) return;
  child.kill();
  await new Promise((r) => child.once("exit", r));
  child = null;
}
async function api(
  path,
  { method = "GET", data, admin = true, headers = {}, body } = {},
) {
  return fetch(origin + path, {
    method,
    headers: {
      ...(data ? { "content-type": "application/json" } : {}),
      ...(method !== "GET" ? { origin } : {}),
      ...(admin && cookie ? { cookie, "x-csrf-token": csrf } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : body,
  });
}
before(async () => {
  const proc = spawn(
    process.execPath,
    ["scripts/admin.mjs", "qa@example.test"],
    { env, stdio: ["pipe", "pipe", "pipe"] },
  );
  proc.stdin.end("Test-only-password-748293!\n");
  assert.equal(await new Promise((r) => proc.on("exit", r)), 0);
  await start();
});
after(async () => {
  await stop();
  await rm(dir, { recursive: true, force: true });
});
test("public page routes render and protected writes require authentication", async () => {
  for (const path of [
    "/",
    "/gallery",
    "/booking",
    "/about",
    "/services",
    "/faq",
    "/admin",
  ])
    assert.equal((await api(path)).status, 200);
  assert.equal((await api("/api/inquiries", { admin: false })).status, 401);
  assert.equal(
    (
      await api("/api/content/heroTitle", {
        method: "PUT",
        admin: false,
        data: { value: { type: "text", text: "no" }, version: 0 },
      })
    ).status,
    401,
  );
});
test("login rejects invalid credentials and creates an HttpOnly session", async () => {
  assert.equal(
    (
      await api("/api/login", {
        method: "POST",
        data: { email: "qa@example.test", password: "wrong" },
      })
    ).status,
    401,
  );
  const r = await api("/api/login", {
    method: "POST",
    data: { email: "qa@example.test", password: "Test-only-password-748293!" },
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.match(r.headers.get("set-cookie"), /Secure/);
  cookie = r.headers.get("set-cookie").split(";")[0];
  csrf = (await r.json()).csrf;
  assert.equal(
    (await api("/api/session").then((r) => r.json())).email,
    "qa@example.test",
  );
});
test("saved content survives restart and concurrent changes return a conflict", async () => {
  const data = { value: { type: "text", text: "QA saved title" }, version: 0 };
  assert.equal(
    (
      await api("/api/content/heroTitle", {
        method: "PUT",
        data,
        headers: { "x-csrf-token": "wrong" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("/api/content/heroTitle", {
        method: "PUT",
        data,
        headers: { origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await api("/api/content/heroTitle", { method: "PUT", data })).status,
    200,
  );
  assert.equal(
    (await api("/api/content/heroTitle", { method: "PUT", data })).status,
    409,
  );
  await stop();
  await start();
  const blocks = await api("/api/content", { admin: false }).then((r) =>
    r.json(),
  );
  assert.equal(blocks.heroTitle.value.text, "QA saved title");
  assert.equal(blocks.heroTitle.version, 1);
});
test("invalid links and unknown content cannot be saved", async () => {
  for (const href of [
    "javascript:alert(1)",
    "//evil.example",
    "/\\evil.example",
  ])
    assert.equal(
      (
        await api("/api/content/heroBook", {
          method: "PUT",
          data: { version: 0, value: { type: "link", text: "bad", href } },
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await api("/api/content/unknown", {
        method: "PUT",
        data: { version: 0, value: { type: "text", text: "bad" } },
      })
    ).status,
    400,
  );
});
test("link visibility persists and only accepts booleans on links", async () => {
  const link = { type: "link", text: "Services", href: "/services" };
  const save = (id, value, version = 0) =>
    api("/api/content/" + id, { method: "PUT", data: { value, version } });
  assert.equal(
    (await save("navServices", { ...link, visible: "false" })).status,
    400,
  );
  assert.equal(
    (await save("faqTitle", { type: "text", text: "FAQ", visible: false }))
      .status,
    400,
  );
  assert.equal((await save("navServices", link)).status, 200);
  assert.equal(
    (await save("navServices", { ...link, visible: false }, 1)).status,
    200,
  );
  const published = await (await api("/api/content", { admin: false })).json();
  assert.equal(published.navServices.value.visible, false);
  assert.equal(
    (await save("navServices", { ...link, visible: true }, 2)).status,
    200,
  );
});
async function upload(bytes, mime, name) {
  const body = new FormData();
  body.append("file", new Blob([bytes], { type: mime }), name);
  return api("/api/upload", { method: "POST", body });
}
test("image uploads are private before save, cancel removes them, save publishes them", async () => {
  const bytes = await sharp({
    create: { width: 800, height: 600, channels: 3, background: "#dacabb" },
  })
    .png()
    .toBuffer();
  let r = await upload(bytes, "image/png", "test.png");
  assert.equal(r.status, 200);
  let m = await r.json();
  assert.equal((await api(m.src, { admin: false })).status, 404);
  assert.equal((await api(m.src)).status, 200);
  await api("/api/upload/" + m.src.slice(7), { method: "DELETE" });
  assert.equal((await api(m.src)).status, 404);
  r = await upload(bytes, "image/png", "test.png");
  m = await r.json();
  assert.equal(
    (
      await api("/api/content/hero", {
        method: "PUT",
        data: {
          version: 0,
          value: { type: "image", src: m.src, alt: "QA image", x: 60, y: 40 },
        },
      })
    ).status,
    200,
  );
  assert.equal((await api(m.src, { admin: false })).status, 200);
  assert.equal(
    (await upload(Buffer.from("<script>bad</script>"), "image/png", "bad.png"))
      .status,
    400,
  );
});
test("valid video is transcoded, stored and published; corrupt video is rejected", async () => {
  const file = join(dir, "clip.mp4");
  await run("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=plum:s=320x240:d=1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    file,
  ]);
  const r = await upload(await readFile(file), "video/mp4", "clip.mp4");
  assert.equal(r.status, 200, await r.clone().text());
  const m = await r.json();
  assert.equal(m.mime, "video/mp4");
  assert.equal(
    (
      await api("/api/content/storyFilm", {
        method: "PUT",
        data: {
          version: 0,
          value: {
            type: "video",
            src: m.src,
            alt: "QA film",
            poster: "/assets/legacy-hero.webp",
            captions: "",
            x: 50,
            y: 50,
          },
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (await api(m.src, { admin: false, headers: { Range: "bytes=0-99" } }))
      .status,
    206,
  );
  assert.equal(
    (await upload(Buffer.from("not video"), "video/mp4", "bad.mp4")).status,
    400,
  );
});
test("consultation requests persist privately and require valid input", async () => {
  assert.equal(
    (
      await api("/api/inquiries", {
        method: "POST",
        admin: false,
        data: { name: "QA" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/api/inquiries", {
        method: "POST",
        admin: false,
        data: {
          name: "QA Test",
          email: "qa@example.test",
          occasion: "Wedding",
          vision: "TEST ONLY",
        },
      })
    ).status,
    201,
  );
  const rows = await api("/api/inquiries").then((r) => r.json());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload.name, "QA Test");
  assert.equal((await api("/api/inquiries", { admin: false })).status, 401);
});
test("invalid media saves and unauthorized uploads preserve published content", async () => {
  const before = await api("/api/content", { admin: false }).then((r) =>
    r.json(),
  );
  for (const value of [
    { ...before.hero.value, src: "/assets/missing.webp" },
    { ...before.hero.value, src: "/assets/celebration-film.mp4" },
    { ...before.hero.value, src: "/media/missing.webp" },
  ]) {
    assert.equal(
      (
        await api("/api/content/hero", {
          method: "PUT",
          data: { value, version: before.hero.version },
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (await api("/api/upload", { method: "POST", admin: false })).status,
    401,
  );
  assert.equal(
    (
      await api("/api/content/heroTitle", {
        method: "PUT",
        data: {
          version: before.heroTitle.version,
          value: {
            type: "text",
            text: "Invalid mixed type",
            src: before.hero.value.src,
          },
        },
      })
    ).status,
    400,
  );
  assert.deepEqual(
    await api("/api/content", { admin: false }).then((r) => r.json()),
    before,
  );
});
test("image and video edits and consultation inbox survive another server restart", async () => {
  const before = await api("/api/content", { admin: false }).then((r) =>
    r.json(),
  );
  await stop();
  await start();
  assert.deepEqual(
    await api("/api/content", { admin: false }).then((r) => r.json()),
    before,
  );
  assert.equal(
    (await api(before.hero.value.src, { admin: false })).status,
    200,
  );
  assert.equal(
    (await api(before.storyFilm.value.src, { admin: false })).status,
    200,
  );
  assert.equal(
    (await api("/api/inquiries").then((r) => r.json()))[0].payload.name,
    "QA Test",
  );
});
test("logout revokes session and write access", async () => {
  assert.equal((await api("/api/logout", { method: "POST" })).status, 200);
  assert.deepEqual(await api("/api/session").then((r) => r.json()), {});
  assert.equal((await api("/api/inquiries")).status, 401);
});
