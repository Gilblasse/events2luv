import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export const dataDir = resolve(process.env.DATA_DIR || "data");
mkdirSync(dataDir, { recursive: true });
export const db = new DatabaseSync(resolve(dataDir, "site.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS blocks(id TEXT PRIMARY KEY,value TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT,editor TEXT);
CREATE TABLE IF NOT EXISTS admins(email TEXT PRIMARY KEY,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,email TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY,block TEXT,value TEXT,version INTEGER,editor TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,path TEXT NOT NULL,mime TEXT NOT NULL,owner TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0,created_at TEXT);
CREATE TABLE IF NOT EXISTS inquiries(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL);
`);
export const hashToken = (t) => createHash("sha256").update(t).digest("hex");
export function passwordHash(p) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
export function verify(p, h) {
  try {
    const [s, v] = h.split(":");
    const b = Buffer.from(v, "hex");
    return b.length === 64 && timingSafeEqual(b, scryptSync(p, s, 64));
  } catch {
    return false;
  }
}
export function createSession(email, password, token, csrf, expires) {
  const result = db.prepare(
    "INSERT INTO sessions SELECT ?,email,?,? FROM admins WHERE email=? AND password=?",
  ).run(token, csrf, expires, email, password);
  return result.changes === 1;
}
export function changePassword(email, token, previousHash, nextHash) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare(
      `UPDATE admins SET password=? WHERE email=? AND password=?
       AND EXISTS (SELECT 1 FROM sessions WHERE token=? AND email=? AND expires>?)`,
    ).run(nextHash, email, previousHash, token, email, Date.now());
    if (result.changes === 1)
      db.prepare("DELETE FROM sessions WHERE email=?").run(email);
    db.exec("COMMIT");
    return result.changes === 1;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function allBlocks() {
  return Object.fromEntries(
    db
      .prepare("SELECT * FROM blocks")
      .all()
      .map((r) => [r.id, { value: JSON.parse(r.value), version: r.version }]),
  );
}
export function saveBlock(id, value, version, email) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const old = db.prepare("SELECT * FROM blocks WHERE id=?").get(id);
    if ((old?.version || 0) !== version) {
      db.exec("ROLLBACK");
      return null;
    }
    if (old)
      db.prepare(
        "INSERT INTO revisions(block,value,version,editor,created_at) VALUES(?,?,?,?,?)",
      ).run(id, old.value, old.version, email, new Date().toISOString());
    const next = version + 1;
    db.prepare(
      "INSERT INTO blocks VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,version=excluded.version,updated_at=excluded.updated_at,editor=excluded.editor",
    ).run(id, JSON.stringify(value), next, new Date().toISOString(), email);
    for (const u of [value.src, value.poster, value.captions])
      if (u?.startsWith("/media/"))
        db.prepare("UPDATE media SET published=1 WHERE id=?").run(u.slice(7));
    db.exec("COMMIT");
    return { value, version: next };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
