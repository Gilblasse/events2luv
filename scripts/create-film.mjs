import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "e2l-film-"));
const photos = [
  "legacy-hero.webp",
  "banquet-flowers.webp",
  "banquet-place-setting.webp",
  "wedding-reception.webp",
];
try {
  for (let i = 0; i < photos.length; i++)
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-loop",
      "1",
      "-i",
      resolve("public/assets", photos[i]),
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00035,1.07)':d=100:s=1280x720:fps=25,setsar=1",
      "-t",
      "4",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-threads",
      "2",
      "-pix_fmt",
      "yuv420p",
      join(dir, i + ".mp4"),
    ]);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    ...photos.flatMap((_, i) => ["-i", join(dir, i + ".mp4")]),
    "-filter_complex",
    "[0:v][1:v]xfade=transition=fade:duration=0.8:offset=3.2[v1];[v1][2:v]xfade=transition=fade:duration=0.8:offset=6.4[v2];[v2][3:v]xfade=transition=fade:duration=0.8:offset=9.6[v]",
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-threads",
    "2",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    "-an",
    "-y",
    "public/assets/celebration-film.mp4",
  ]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
