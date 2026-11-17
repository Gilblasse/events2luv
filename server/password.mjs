import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";
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
