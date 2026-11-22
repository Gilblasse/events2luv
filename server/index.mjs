import express from "express";
import { purgeCache } from "@netlify/cache";
import { putMedia, sendMedia, removeMedia, installChunkUploads } from "./netlify-media.mjs";
import { processVideo } from "./video.mjs";
import multer from "multer";
import sharp from "sharp";
import nodemailer from "nodemailer";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import {
  db,
  dataDir,
  verify,
  hashToken,
  passwordHash,
  changePassword,
  createSession,
  allBlocks,
  saveBlock,
} from "./store.mjs";
import { validateBlock } from "./schema.mjs";
const app = express(),
  prod = process.env.NODE_ENV === "production";
const sandbox = process.env.E2L_SANDBOX;
const contentCacheTag = sandbox ? `events2luv-content-${sandbox}` : 'events2luv-content';
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
if (prod && !process.env.APP_ORIGIN && !process.env.NETLIFY)
  throw Error("APP_ORIGIN is required in production.");
const mediaDir = resolve(dataDir, "media");
mkdirSync(mediaDir, { recursive: true });
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' ws:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(async (req, res, next) => {
  // Published content is identical for every visitor and safe to cache publicly.
  if (req.method === 'GET' && req.path === '/api/content') return next();
  let token;
  try {
    token = decodeURIComponent(
      (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("e2l="))
        ?.slice(4) || "",
    );
  } catch {}
  req.session = token
    ? await db
        .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
        .get(hashToken(token), Date.now())
    : null;
  next();
});
const gate = (req, res, next) =>
  req.session
    ? next()
    : res.status(401).json({ error: "Please sign in as an admin." });
function origin(req, res, next) {
  const expected = process.env.E2L_SANDBOX_ORIGIN ||
    (process.env.NETLIFY ? process.env.DEPLOY_PRIME_URL || process.env.URL : process.env.APP_ORIGIN) || `${req.protocol}://${req.headers.host}`;
  if (req.headers.origin !== expected)
    return res.status(403).json({ error: "Request origin is not allowed." });
  next();
}
const csrf = (req, res, next) =>
  req.headers["x-csrf-token"] === req.session?.csrf
    ? next()
    : res
        .status(403)
        .json({ error: "Your session changed. Refresh and sign in again." });
const limits = new Map();
async function rate(key, max, window) {
  if (process.env.NETLIFY) return (await import("./postgres-store.mjs")).rate(key, max, window);
  const now = Date.now();
  if (limits.size > 10000)
    for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  let r = limits.get(key);
  if (!r || r.until < now) r = { count: 0, until: now + window };
  r.count++;
  limits.set(key, r);
  return r.count <= max;
}
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.get("/api/content", async (req, res) => {
  const blocks = await allBlocks();
  if (process.env.NETLIFY) res.set({
    'Netlify-CDN-Cache-Control': 'public, durable, max-age=86400',
    'Netlify-Cache-Tag': contentCacheTag,
  });
  res.json(blocks);
});
app.get("/api/admin/content", gate, async (req, res) => res.json(await allBlocks()));
app.get("/api/session", (req, res) =>
  res.json(
    req.session ? { email: req.session.email, csrf: req.session.csrf } : {},
  ),
);
app.post("/api/login", origin, async (req, res) => {
  if (!await rate("login:" + req.ip, 10, 900000))
    return res
      .status(429)
      .json({ error: "Too many attempts. Please try again later." });
  const { email, password } = req.body;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length > 256
  )
    return res.status(400).json({ error: "Enter your email and password." });
  const a = await db
    .prepare("SELECT * FROM admins WHERE email=?")
    .get(email.toLowerCase().trim());
  if (!a || !verify(password, a.password))
    return res.status(401).json({ error: "Email or password is incorrect." });
  const token = randomBytes(32).toString("hex"),
    c = randomBytes(24).toString("hex");
  await db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  if (!(await createSession(a.email, a.password, hashToken(token), c, Date.now() + 8 * 3600000)))
    return res.status(401).json({ error: "Email or password is incorrect." });
  res.setHeader(
    "Set-Cookie",
    `e2l=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${prod ? "; Secure" : ""}`,
  );
  res.json({ email: a.email, csrf: c });
});
function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `e2l=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${prod ? "; Secure" : ""}`,
  );
}
app.post("/api/logout", gate, origin, csrf, async (req, res) => {
  await db.prepare("DELETE FROM sessions WHERE token=?").run(req.session.token);
  clearSessionCookie(res);
  res.json({ ok: true });
});
app.post("/api/admin/password", gate, origin, csrf, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 256)
    return res.status(400).json({ error: "Enter your current password." });
  if (typeof newPassword !== "string" || newPassword.length < 14 || newPassword.length > 256)
    return res.status(400).json({ error: "Use 14 to 256 characters for your new password." });
  if (newPassword !== confirmPassword)
    return res.status(400).json({ error: "The new passwords do not match." });
  if (currentPassword === newPassword)
    return res.status(400).json({ error: "Choose a different password." });

  const { email, token } = req.session;
  if (!(await rate("change-password:" + email, 10, 900000)))
    return res.status(429).json({ error: "Too many attempts. Please try again later." });
  const admin = await db.prepare("SELECT password FROM admins WHERE email=?").get(email);
  if (!admin || !verify(currentPassword, admin.password))
    return res.status(403).json({ error: "Your current password is incorrect." });
  if (!(await changePassword(email, token, admin.password, passwordHash(newPassword))))
    return res.status(409).json({ error: "Your credentials or session changed. Sign in again." });

  clearSessionCookie(res);
  res.json({ ok: true });
});
app.put("/api/content/:id", gate, origin, csrf, async (req, res) => {
  const { value, version } = req.body;
  if (!Number.isInteger(version) || !validateBlock(req.params.id, value))
    return res
      .status(400)
      .json({ error: "Please check the content and link format." });
  for (const key of ["src", "poster", "captions"]) {
    const u = value[key];
    if (u?.startsWith("/assets/")) {
      const isVideo = key === "src" && value.type === "video";
      const validExtension = isVideo
        ? /\.(mp4|webm)$/i
        : /\.(jpe?g|png|webp)$/i;
      if (!validExtension.test(u) || !existsSync(resolve("public", u.slice(1))))
        return res
          .status(400)
          .json({ error: "That media file is not available for this slot." });
    }
    if (u?.startsWith("/media/")) {
      const m = await db.prepare("SELECT * FROM media WHERE id=?").get(u.slice(7));
      if (!m || (!m.published && m.owner !== req.session.email))
        return res.status(400).json({ error: "Upload is not available." });
      if (
        (key === "src" &&
          value.type === "image" &&
          !m.mime.startsWith("image/")) ||
        (key === "poster" && !m.mime.startsWith("image/")) ||
        (key === "src" &&
          value.type === "video" &&
          !m.mime.startsWith("video/")) ||
        (key === "captions" && m.mime !== "text/vtt")
      )
        return res
          .status(400)
          .json({ error: "That file does not match this media slot." });
    }
  }
  const saved = await saveBlock(req.params.id, value, version, req.session.email);
  if (saved && process.env.NETLIFY) {
    try { await purgeCache({tags:[contentCacheTag]}); }
    catch {
      console.error('Content saved; public cache refresh failed.');
      saved.warning = 'Your changes are saved, but public refresh is delayed. Redeploy the site to refresh it immediately.';
    }
  }
  return saved
    ? res.json(saved)
    : res.status(409).json({
        error:
          "Another admin updated this item. Your draft is preserved. Reload the latest version before saving.",
      });
});
installChunkUploads(app, { gate, origin, csrf, db, processVideo, sharp });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
});
app.post(
  "/api/upload",
  gate,
  origin,
  csrf,
  async (req, res, next) => {
    if (!await rate("upload:" + req.session.email, 30, 3600000))
      return res
        .status(429)
        .json({ error: "Upload limit reached. Try again later." });
    next();
  },
  upload.single("file"),
  async (req, res) => {
    try {
      const f = req.file;
      if (!f) return res.status(400).json({ error: "Choose a file." });
      let buffer,
        mime,
        ext,
        meta = {};
      if (["image/jpeg", "image/png", "image/webp"].includes(f.mimetype)) {
        if (f.size > 15 * 1024 * 1024)
          throw Error("Images must be 15 MB or smaller.");
        const m = await sharp(f.buffer, {
          limitInputPixels: 40000000,
        }).metadata();
        if (!["jpeg", "png", "webp"].includes(m.format))
          throw Error("Use JPG, PNG or WebP.");
        buffer = await sharp(f.buffer)
          .rotate()
          .resize({
            width: 3000,
            height: 3000,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 88 })
          .toBuffer();
        const out = await sharp(buffer).metadata();
        meta = { width: out.width, height: out.height };
        mime = "image/webp";
        ext = "webp";
      } else if (f.mimetype === "text/vtt" || f.originalname.endsWith(".vtt")) {
        if (
          f.size > 1024 * 1024 ||
          !f.buffer.toString("utf8").startsWith("WEBVTT")
        )
          throw Error("Use a valid WebVTT captions file under 1 MB.");
        buffer = f.buffer;
        mime = "text/vtt";
        ext = "vtt";
      } else if (["video/mp4", "video/webm"].includes(f.mimetype)) {
        ({ buffer, mime, ext, meta } = await processVideo(f.buffer));
      } else throw Error("Use JPG, PNG, WebP, MP4, WebM, or WebVTT files.");
      const id = randomUUID() + "." + ext;
      if (process.env.NETLIFY) await putMedia(id, buffer);
      else writeFileSync(resolve(mediaDir, id), buffer);
      await db.prepare("INSERT INTO media VALUES(?,?,?,?,0,?)").run(
        id,
        id,
        mime,
        req.session.email,
        new Date().toISOString(),
      );
      res.json({ src: "/media/" + id, mime, ...meta });
    } catch (e) {
      res
        .status(400)
        .json({ error: e.message || "This file could not be processed." });
    }
  },
);
app.get("/media/:id", async (req, res) => {
  const m = await db.prepare("SELECT * FROM media WHERE id=?").get(req.params.id);
  if (!m || (!m.published && m.owner !== req.session?.email))
    return res.sendStatus(404);
  res.set({
    "Content-Type": m.mime,
    "Cache-Control": m.published
      ? "public, max-age=31536000, immutable"
      : "private, no-store",
  });
  if (process.env.NETLIFY) return sendMedia(req, res, m);
  res.sendFile(resolve(mediaDir, m.path));
});
app.delete("/api/upload/:id", gate, origin, csrf, async (req, res) => {
  const m = await db
    .prepare("SELECT * FROM media WHERE id=? AND owner=? AND published=0")
    .get(req.params.id, req.session.email);
  if (m && process.env.NETLIFY) {
    const deleted = await db.prepare("DELETE FROM media WHERE id=? AND owner=? AND published=0 RETURNING id").get(m.id, req.session.email);
    if (deleted) await removeMedia(m.id);
    return res.json({ ok: true });
  }
  if (m) {
    try {
      unlinkSync(resolve(mediaDir, m.path));
    } catch {}
    await db.prepare("DELETE FROM media WHERE id=?").run(m.id);
  }
  res.json({ ok: true });
});
const inquirySections = [
  ["Contact", { name: "Name", email: "Email address", phone: "Phone" }],
  ["Event details", {
    occasion: "Event type", date: "Preferred date", flexible: "Date flexibility",
    location: "Location", guests: "Estimated guests", budget: "Event budget",
  }],
  ["In their words", { vision: "Event vision", inspiration: "Inspiration" }],
];

function emailText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replace(/\r\n?|\n/g, "<br>");
}

function inquiryEmail(data) {
  const sections = inquirySections.map(([title, labels]) => ({
    title,
    rows: Object.entries(labels).map(([key, label]) => [label, data[key] || "Not provided"]),
  }));
  const text = sections.map(({ title, rows }) =>
    [title, ...rows.map(([label, value]) => label + ": " + value)].join("\n")
  ).join("\n\n");

  const content = sections.map(({ title, rows }) => `
    <tr><td style="padding:24px 24px 6px">
      <h2 style="margin:0;color:#4a253b;font:normal 24px Georgia,serif">${title}</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed">
        ${rows.map(([label, value]) => `<tr>
          <th scope="row" width="38%" align="left" valign="top" style="padding:11px 8px 11px 0;border-bottom:1px solid #e6dcd3;color:#695a61;font:normal 14px/1.5 Arial,sans-serif">${label}</th>
          <td valign="top" style="padding:11px 0;border-bottom:1px solid #e6dcd3;color:#382e33;font:16px/1.5 Arial,sans-serif;overflow-wrap:anywhere;word-break:break-word">${emailText(value)}</td>
        </tr>`).join("")}
      </table>
    </td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f8f4ee">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8f4ee"><tr><td align="center" style="padding:18px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #dfd5cc">
        <tr><td bgcolor="#4a253b" style="padding:26px 24px;border-bottom:3px solid #b79b67">
          <p style="margin:0 0 14px;color:#ead9c2;font:18px Georgia,serif">Events2Luv</p>
          <h1 style="margin:0;color:#fff;font:normal 32px/1.15 Georgia,serif">New consultation request</h1>
        </td></tr>
        ${content}
        <tr><td style="padding:20px 24px;color:#695a61;font:14px/1.5 Arial,sans-serif">Reply to this email to contact the requester.</td></tr>
      </table>
    </td></tr></table></body></html>`;
  return { text, html };
}

app.post("/api/inquiries", origin, async (req, res) => {
  if (!await rate("inquiry:" + req.ip, 5, 3600000))
    return res.status(429).json({
      code: "inquiryRate",
      error: "Please try again later, or email us directly.",
    });
  const b = req.body;
  if (b.website) return res.json({ ok: true });
  const fields = inquirySections.flatMap(([, labels]) => Object.keys(labels));
  const data = {};
  for (const k of fields) {
    if (typeof b[k] === "string" && b[k].length <= 4000) data[k] = b[k].trim();
  }
  if (
    !data.name ||
    !data.email ||
    !/^\S+@\S+\.\S+$/.test(data.email) ||
    !data.occasion
  )
    return res.status(400).json({
      code: "inquiryInvalid",
      error: "Please enter your name, email, and event type.",
    });
  const id = randomUUID();
  await db.prepare("INSERT INTO inquiries VALUES(?,?,?)").run(
    id,
    JSON.stringify(data),
    new Date().toISOString(),
  );
  if (!sandbox && process.env.SMTP_URL && process.env.INQUIRY_TO && process.env.MAIL_FROM) {
    try {
      await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
        from: process.env.MAIL_FROM,
        to: process.env.INQUIRY_TO,
        replyTo: data.email,
        subject: "Events2Luv consultation request",
        ...inquiryEmail(data),
      });
    } catch {
      console.error("Inquiry saved; email notification failed:", id);
    }
  }
  res.status(201).json({ ok: true, id });
});
app.get("/api/inquiries", gate, async (req, res) =>
  res.json(
    (await db
      .prepare("SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 200")
      .all())
      .map((x) => ({ ...x, payload: JSON.parse(x.payload) })),
  ),
);
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
app.use("/assets", express.static(resolve("public/assets")));
if (process.env.NETLIFY) {
  // Netlify serves the Vite build and SPA fallback.
} else if (prod) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((err, req, res, next) => {
  console.error(err.code || err.message);
  res.status(400).json({
    error:
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Maximum upload is 100 MB."
        : "The request could not be completed.",
  });
});
const portArg = process.argv.indexOf("--port");
export default app;
if (!process.env.NETLIFY) app.listen(
  process.env.PORT || (portArg >= 0 ? Number(process.argv[portArg + 1]) : 3000),
  "0.0.0.0",
  () => console.log("Events2Luv server ready"),
);
