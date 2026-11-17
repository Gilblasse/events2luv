import { test, expect } from "@playwright/test";

test("chapters have isolated captions through slow, fast and reverse scrolling; navigation and history agree", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/gallery");
  await expect(page.locator(".narrative")).toHaveClass(/is-directed/);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.mouse.wheel(0, -500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(100);
  const range = await page.locator(".pin-spacer").evaluate((e) => ({
    start: e.getBoundingClientRect().top + scrollY,
    end: e.getBoundingClientRect().top + scrollY + e.offsetHeight - innerHeight,
  }));
  for (const progress of [
    ...Array.from({ length: 41 }, (_, i) => i / 40),
    1,
    0,
    0.85,
    0.15,
    ...Array.from({ length: 21 }, (_, i) => 1 - i / 20),
  ]) {
    await page.evaluate(
      ({ start, end, progress }) =>
        scrollTo(0, start + (end - start) * progress),
      { ...range, progress },
    );
    await page.waitForTimeout(35);
    const count = await page
      .locator(".narrative-caption")
      .evaluateAll(
        (es) =>
          es.filter(
            (e) =>
              getComputedStyle(e).visibility === "visible" &&
              Number(getComputedStyle(e).opacity) > 0.05,
          ).length,
      );
    expect(count, "captions must not crossfade").toBeLessThanOrEqual(1);
  }
  for (const [index, chapter] of ["spark", "details", "moment"].entries()) {
    await page.locator(".story-navigation a").nth(index).click();
    await expect(page).toHaveURL(new RegExp("#" + chapter + "$"));
    await expect(page.locator("#" + chapter)).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await expect(page.locator("#" + chapter + " .narrative-caption")).toHaveCSS(
      "opacity",
      "1",
    );
  }
  await page.goBack();
  await expect(page.locator("#details")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await page.goForward();
  await expect(page.locator("#moment")).toHaveAttribute("aria-hidden", "false");
  await page.reload();
  await expect(page.locator("#moment")).toHaveAttribute("aria-hidden", "false");
  expect(errors).toEqual([]);
});

test("resize, short viewports, reduced motion and animation failure preserve the complete story", async ({
  page,
}) => {
  await page.goto("/gallery");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await page.locator(".story-navigation a").nth(1).click();
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1280, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    await expect(
      page.locator(".narrative-panel[aria-hidden=true]"),
    ).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  for (const panel of await page.locator(".narrative-panel").all())
    await expect(panel).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/storyMotion-*.js", (route) => route.abort());
  await page.reload();
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(page.locator(".narrative-panel[aria-hidden=true]")).toHaveCount(
    0,
  );
});

test("lightbox traps keyboard focus, closes on Escape and restores its trigger", async ({
  page,
}) => {
  await page.goto("/gallery");
  const trigger = page.locator(".collection-grid button").first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("phone menu, form widths, flexible date and inspiration survive submission to an isolated store", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery");
  expect(
    await page
      .locator(".narrative-photo")
      .first()
      .evaluate((e) => e.getBoundingClientRect().top),
  ).toBeLessThan(500);
  await page.locator(".mobile-nav summary").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".mobile-nav")).not.toHaveAttribute("open", "");
  await page.locator(".mobile-nav summary").click();
  await page.locator('.mobile-nav a[href="/booking"]').click();
  await page.goto("/booking?inspiration=The%20details");
  await expect(page.locator(".inspiration")).toContainText("The details");
  for (const input of await page
    .locator(".form-grid input:not([type=checkbox])")
    .all())
    expect(await input.evaluate((e) => e.clientWidth)).toBeGreaterThan(280);
  await page.getByLabel("Your name", { exact: true }).fill("Browser fixture");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("fixture@example.test");
  await page
    .getByRole("combobox", { name: "Event type", exact: true })
    .selectOption({ label: "Wedding" });
  await page.getByLabel("My date is flexible").check();
  await page.getByRole("button", { name: "Request a consultation" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your request has been received",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("admin editing tears down motion, saves durably, cancels only drafts and recovers from failed writes", async ({
  page,
  browser,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Email", { exact: true }).fill("browser@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-test-only-748293!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Preview website" }),
  ).toBeVisible();
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  for (const id of ["spark", "details", "moment"])
    await expect(
      page.getByRole("button", { name: "Edit " + id, exact: true }),
    ).toBeVisible();
  const edit = () =>
    page.getByRole("button", { name: "Edit sparkTitle", exact: true }).click();
  await edit();
  const text = page.locator(".drawer textarea");
  await text.fill("Saved browser story");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".drawer")).toHaveCount(0);
  await edit();
  await text.fill("Unsaved story");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#spark h2")).toHaveText("Saved browser story");
  await edit();
  await text.fill("Retry browser story");
  await page.route(
    "**/api/content/sparkTitle",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Test save unavailable" }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".drawer")).toContainText("Test save unavailable");
  await expect(text).toHaveValue("Retry browser story");
  const publicContext = await browser.newContext();
  const visitor = await publicContext.newPage();
  await visitor.goto("http://localhost:4400/gallery");
  await expect(visitor.locator("#spark h2")).toHaveText("Saved browser story");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".drawer")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#spark h2")).toHaveText("Retry browser story");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Preview website" }).click();
    await expect(page.locator(".pin-spacer")).toHaveCount(1);
    await page.getByRole("button", { name: "Edit mode", exact: true }).click();
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await visitor.reload();
  await expect(visitor.locator("#spark h2")).toHaveText("Retry browser story");
  await publicContext.close();
});
