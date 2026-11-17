import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.QA_ORIGIN || "http://localhost:3000";
const dir = "artifacts/refinement";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1440, 900],
  [1280, 720],
]) {
  await page.setViewportSize({ width, height });
  for (const route of [
    "/",
    "/gallery",
    "/services",
    "/about",
    "/booking",
    "/faq",
  ]) {
    await page.goto(origin + route);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const name = route === "/" ? "home" : route.slice(1);
    const metrics = await page.evaluate(() => ({
      h1: [...document.querySelectorAll("h1")].map((e) => e.textContent),
      overflow: document.documentElement.scrollWidth > innerWidth,
      photoTop: document
        .querySelector(".narrative-photo")
        ?.getBoundingClientRect().top,
      inputs: [
        ...document.querySelectorAll(".form-grid input:not([type=checkbox])"),
      ].map((e) => ({ name: e.name, width: e.clientWidth })),
    }));
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      width,
      height,
      route,
      ...metrics,
      violations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    console.log(
      `${width} ${route}: ${axe.violations.length} accessibility findings`,
    );
    await page.screenshot({
      path: `${dir}/after-${name}-${width}.png`,
      fullPage: route !== "/gallery" && route !== "/",
    });
  }
}
await writeFile(
  `${dir}/accessibility.json`,
  JSON.stringify({ results, errors }, null, 2),
);
console.log(
  JSON.stringify(
    {
      checks: results.length,
      violations: results.filter((r) => r.violations.length),
      overflow: results.filter((r) => r.overflow),
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
if (
  errors.length ||
  results.some(
    (result) =>
      result.violations.length || result.overflow || result.h1.length !== 1,
  )
)
  process.exitCode = 1;
