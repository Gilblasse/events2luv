import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
let processing = false;
export async function processVideo(input) {
  if (processing)
    throw Error("Another video is processing. Please try again shortly.");
  processing = true;
  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), "events2luv-video-"));
    const source = join(dir, "source"),
      output = join(dir, "video.mp4");
    await writeFile(source, input);
    const { stdout } = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        source,
      ],
      { timeout: 20000, maxBuffer: 1024 * 1024 },
    );
    const probe = JSON.parse(stdout),
      stream = probe.streams?.find((s) => s.codec_type === "video");
    const duration = Number(probe.format?.duration);
    if (
      !stream ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 300 ||
      stream.width > 4096 ||
      stream.height > 4096 ||
      !/(mov|mp4|webm|matroska)/.test(probe.format.format_name)
    )
      throw Error(
        "Use an MP4 or WebM video under 5 minutes and at most 4096 pixels wide or high.",
      );
    await run(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        source,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-map_metadata",
        "-1",
        "-vf",
        "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "24",
        "-threads",
        "2",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-t",
        "300",
        output,
      ],
      { timeout: 240000, maxBuffer: 1024 * 1024 },
    );
    const buffer = await readFile(output);
    if (buffer.length > 100 * 1024 * 1024)
      throw Error(
        "Processed video is too large. Please choose a shorter clip.",
      );
    return { buffer, mime: "video/mp4", ext: "mp4", meta: { duration } };
  } catch (e) {
    if (e.code === "ENOENT")
      throw Error(
        "Video processing is unavailable. Please install FFmpeg on the server.",
      );
    if (e.killed)
      throw Error("Video processing took too long. Please try a shorter clip.");
    if (e.message?.startsWith("Command failed"))
      throw Error(
        "This video could not be decoded. Please use a valid MP4 or WebM.",
      );
    throw e;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
    processing = false;
  }
}
