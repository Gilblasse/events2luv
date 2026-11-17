import sharp from "sharp";
import { readdir, writeFile, readFile, mkdir } from "node:fs/promises";
await mkdir("assets/original", { recursive: true });
const manifest = JSON.parse(await readFile("assets/manifest.json", "utf8"));
for (const asset of manifest.assets.filter((x) =>
  x.filename.endsWith(".jpg"),
)) {
  try {
    await readFile("assets/original/" + asset.filename);
  } catch {
    const r = await fetch(asset.source);
    if (!r.ok) throw Error("Asset download failed: " + asset.filename);
    await writeFile(
      "assets/original/" + asset.filename,
      Buffer.from(await r.arrayBuffer()),
    );
  }
}
for (const name of await readdir("assets/original"))
  if (name.endsWith(".jpg")) {
    await sharp("assets/original/" + name)
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toFile("public/assets/" + name.replace(".jpg", ".webp"));
  }
