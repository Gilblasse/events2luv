import { content, isBookingLabel } from "../src/content.js";
export const safeLink = (v) =>
  typeof v === "string" &&
  v.length <= 2048 &&
  (/^(https?:\/\/|mailto:|tel:)/i.test(v) ||
    (/^\/(?!\/)/.test(v) && !/[\\\x00-\x20]/.test(v)) ||
    /^#[\w-]*$/.test(v));
export function validateBlock(id, v) {
  if (!Object.hasOwn(content, id)) return false;
  const d = content[id];
  if (!d || !v || v.type !== d.type) return false;
  const fields = {
    text: isBookingLabel(id) ? ["type", "text", "visible", "required"] : ["type", "text"],
    link: ["type", "text", "href", "visible"],
    image: ["type", "src", "alt", "x", "y", "mobileX", "mobileY"],
    video: ["type", "src", "alt", "x", "y", "poster", "captions"],
  };
  if (Object.keys(v).some((key) => !fields[d.type].includes(key))) return false;
  if (v.type === "text")
    return (
      typeof v.text === "string" &&
      v.text.trim().length > 0 &&
      v.text.length <= 12000 &&
      (v.required === undefined || typeof v.required === "boolean") &&
      (v.visible === undefined || typeof v.visible === "boolean")
    );
  if (v.type === "link")
    return (
      typeof v.text === "string" &&
      v.text.length > 0 &&
      v.text.length <= 200 &&
      safeLink(v.href) &&
      (v.visible === undefined || typeof v.visible === "boolean")
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
