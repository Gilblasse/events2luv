import { content } from "../src/content.js";
export const safeLink = (v) =>
  typeof v === "string" &&
  v.length <= 2048 &&
  (/^(https?:\/\/|mailto:|tel:)/i.test(v) ||
    (/^\/(?!\/)/.test(v) && !/[\\\x00-\x20]/.test(v)) ||
    /^#[\w-]*$/.test(v));
export function validateBlock(id, v) {
  const d = content[id];
  if (!d || !v || v.type !== d.type) return false;
  if (
    Object.keys(v).some(
      (k) =>
        ![
          "type",
          "text",
          "href",
          "src",
          "alt",
          "x",
          "y",
          "poster",
          "captions",
          "mobileX",
          "mobileY",
        ].includes(k),
    )
  )
    return false;
  if (v.type === "text")
    return (
      typeof v.text === "string" &&
      v.text.trim().length > 0 &&
      v.text.length <= 12000
    );
  if (v.type === "link")
    return (
      typeof v.text === "string" &&
      v.text.length > 0 &&
      v.text.length <= 200 &&
      safeLink(v.href)
    );
  if (v.type === "image" || v.type === "video")
    return (
      ((v.type === "video" && v.src === "") ||
        /^\/(assets|media)\/[\w.-]+$/.test(v.src)) &&
      typeof v.alt === "string" &&
      v.alt.length <= 500 &&
      Number.isFinite(v.x) &&
      Number.isFinite(v.y) &&
      v.x >= 0 &&
      v.x <= 100 &&
      v.y >= 0 &&
      v.y <= 100 &&
      ["mobileX", "mobileY"].every(
        (k) =>
          v[k] === undefined ||
          (Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 100),
      ) &&
      (!v.poster || /^\/(assets|media)\/[\w.-]+$/.test(v.poster)) &&
      (!v.captions || /^\/media\/[\w.-]+$/.test(v.captions))
    );
  return false;
}
