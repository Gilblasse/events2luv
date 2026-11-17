import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { launch } from "chrome-launcher";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const data = await mkdtemp(join(tmpdir(), "events2luv-lighthouse-"));
const origin = "http://localhost:4401";
const server = spawn(process.execPath, ["server/index.mjs"], {
  env: {
    ...process.env,
    DATA_DIR: data,
    NODE_ENV: "production",
    PORT: "4401",
    APP_ORIGIN: origin,
    SMTP_URL: "",
    MAIL_FROM: "",
    INQUIRY_TO: "",
  },
  stdio: "ignore",
});
let chrome;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  chrome = await launch({ chromeFlags: ["--headless=new", "--no-first-run"] });
  await mkdir("artifacts/refinement", { recursive: true });
  const summary = [];
  for (const mode of ["mobile", "desktop"])
    for (const route of ["/", "/gallery"]) {
      const flags = {
        port: chrome.port,
        output: ["html", "json"],
        logLevel: "error",
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
        ...(mode === "desktop" ? { preset: "desktop" } : {}),
      };
      const result = await lighthouse(
        origin + route,
        flags,
        mode === "desktop" ? desktopConfig : undefined,
      );
      const name = `lighthouse-${mode}-${route === "/" ? "home" : "gallery"}`;
      await writeFile(`artifacts/refinement/${name}.html`, result.report[0]);
      await writeFile(`artifacts/refinement/${name}.json`, result.report[1]);
      const lhr = result.lhr;
      const entry = {
        mode,
        route,
        version: lhr.lighthouseVersion,
        environment: lhr.environment,
        config: lhr.configSettings,
        scores: Object.fromEntries(
          Object.entries(lhr.categories).map(([k, v]) => [
            k,
            Math.round(v.score * 100),
          ]),
        ),
        metrics: Object.fromEntries(
          [
            "first-contentful-paint",
            "largest-contentful-paint",
            "cumulative-layout-shift",
            "total-blocking-time",
            "speed-index",
          ].map((k) => [k, lhr.audits[k].displayValue]),
        ),
        warnings: lhr.runWarnings,
      };
      summary.push(entry);
      console.log(
        JSON.stringify({
          mode,
          route,
          scores: entry.scores,
          metrics: entry.metrics,
        }),
      );
    }
  await writeFile(
    "artifacts/refinement/lighthouse-summary.json",
    JSON.stringify(summary, null, 2),
  );
} finally {
  await chrome?.kill();
  server.kill();
  await new Promise((r) => server.once("exit", r));
  await rm(data, { recursive: true, force: true });
}
