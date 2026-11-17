import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
await mkdir("artifacts/refinement", { recursive: true });
const names = (await readdir("public/assets")).filter(
  (x) =>
    x.endsWith(".webp") &&
    !x.includes("inspiration") &&
    !/-w\d+\.webp$/.test(x),
);
const tiles = await Promise.all(
  names.map(async (n, i) => ({
    input: await sharp("public/assets/" + n)
      .resize(260, 240, { fit: "contain", background: "#f8f4ee" })
      .extend({ bottom: 35, background: "#f8f4ee" })
      .composite([
        {
          input: Buffer.from(
            `<svg width="260" height="35"><text x="8" y="23" font-size="14">${n}</text></svg>`,
          ),
          top: 240,
          left: 0,
        },
      ])
      .png()
      .toBuffer(),
    left: (i % 4) * 260,
    top: Math.floor(i / 4) * 275,
  })),
);
await sharp({
  create: {
    width: 1040,
    height: Math.ceil(names.length / 4) * 275,
    channels: 3,
    background: "#f8f4ee",
  },
})
  .composite(tiles)
  .png()
  .toFile("artifacts/refinement/asset-contact-sheet.png");
