import { test, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
for (const k of [
  "window",
  "document",
  "HTMLElement",
  "Element",
  "location",
  "Event",
  "MouseEvent",
  "FormData",
])
  globalThis[k] = dom.window[k];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
globalThis.removeEventListener = dom.window.removeEventListener.bind(
  dom.window,
);
globalThis.confirm = () => true;
globalThis.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = clearTimeout;
const React = await import("react"),
  { render, screen, fireEvent, waitFor, cleanup } =
    await import("@testing-library/react");
const output = await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  external: ["react", "react-dom/client"],
  loader: { ".css": "empty" },
});
const path = new URL("../.editor-test-build.mjs", import.meta.url);
await writeFile(path, output.outputFiles[0].text);
const { App } = await import(path.href);
after(async () => {
  cleanup();
  dom.window.close();
  await unlink(path);
});
let records = {},
  writes = 0,
  failNextSave = false;
globalThis.fetch = async (url, opts = {}) => {
  if (url === "/api/session")
    return Response.json({ email: "test@example.test", csrf: "test-token" });
  if (url === "/api/content") return Response.json(records);
  if (url.startsWith("/api/content/") && opts.method === "PUT") {
    const id = url.split("/").at(-1),
      { value, version } = JSON.parse(opts.body);
    if (failNextSave) {
      failNextSave = false;
      return Response.json(
        { error: "Save failed; please retry." },
        { status: 503 },
      );
    }
    records[id] = { value, version: version + 1 };
    writes++;
    return Response.json(records[id]);
  }
  throw Error("Unexpected request: " + url);
};
const button = (name) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === name,
  );
const edit = (id) => document.querySelector('[aria-label="Edit ' + id + '"]');
const words = () => document.querySelector(".drawer textarea");
const heading = () => document.querySelector("h1").textContent;
const closed = () =>
  waitFor(() => {
    if (document.querySelector(".drawer")) throw Error("Editor still open");
  });
test("inline text Cancel discards draft and Save survives remount; subsequent Cancel keeps saved value", async () => {
  let app = render(React.createElement(App));
  await waitFor(() => {
    if (!edit("heroTitle")) throw Error("Waiting for admin");
  });
  fireEvent.click(edit("heroTitle"));
  assert.equal(screen.queryByRole("switch"), null);
  fireEvent.change(words(), { target: { value: "An unsaved heading" } });
  assert.ok(heading().includes("An unsaved heading"));
  fireEvent.click(button("Cancel"));
  await closed();
  assert.ok(heading().includes("Your moment."));
  assert.equal(writes, 0);
  fireEvent.click(edit("heroTitle"));
  fireEvent.change(words(), { target: { value: "A saved heading" } });
  fireEvent.click(button("Save changes"));
  await closed();
  assert.equal(writes, 1);
  app.unmount();
  app = render(React.createElement(App));
  await waitFor(() => {
    if (!edit("heroTitle")) throw Error("Waiting for admin");
  });
  assert.ok(heading().includes("A saved heading"));
  fireEvent.click(edit("heroTitle"));
  fireEvent.change(words(), { target: { value: "Discard this revision" } });
  fireEvent.click(button("Cancel"));
  await closed();
  assert.ok(heading().includes("A saved heading"));
  assert.equal(writes, 1);
  app.unmount();
});
test("shared link label and destination preview together and Cancel reverts both", async () => {
  const app = render(React.createElement(App));
  await waitFor(() => {
    if (!edit("navServices")) throw Error("Waiting for admin");
  });
  fireEvent.click(edit("navServices"));
  fireEvent.change(words(), { target: { value: "Our services updated" } });
  fireEvent.change(document.querySelector(".drawer input"), {
    target: { value: "/about" },
  });
  const links = [...document.querySelectorAll("a")].filter(
    (x) => x.textContent === "Our services updated",
  );
  assert.equal(links.length, 3);
  assert.ok(links.every((x) => x.getAttribute("href") === "/about"));
  fireEvent.click(button("Cancel"));
  await closed();
  assert.ok(
    [...document.querySelectorAll("a")]
      .filter((x) => x.textContent === "Services")
      .every((x) => x.getAttribute("href") === "/services"),
  );
  app.unmount();
});

test("failed Save keeps the draft for retry and leaves saved content intact", async () => {
  const app = render(React.createElement(App));
  await waitFor(() => {
    if (!edit("heroTitle")) throw Error("Waiting for admin");
  });
  const original = structuredClone(records.heroTitle);
  fireEvent.click(edit("heroTitle"));
  fireEvent.change(words(), { target: { value: "Retry this draft" } });
  failNextSave = true;
  fireEvent.click(button("Save changes"));
  await screen.findByText("Save failed; please retry.");
  assert.equal(words().value, "Retry this draft");
  assert.deepEqual(records.heroTitle, original);
  fireEvent.click(button("Save changes"));
  await closed();
  assert.equal(records.heroTitle.value.text, "Retry this draft");
  app.unmount();
});

test("a hidden shared link disappears in preview and can be restored in edit mode", async () => {
  const app = render(React.createElement(App));
  const toggle = () =>
    screen.getByRole("switch", { name: "Show link to visitors" });
  const faqLinks = () => document.querySelectorAll('a[href="/faq"]');
  await waitFor(() => assert.ok(edit("navFaq")));
  assert.equal(button("Requests"), undefined);

  fireEvent.click(edit("navFaq"));
  assert.equal(toggle().checked, true);
  fireEvent.click(toggle());
  fireEvent.click(button("Cancel"));
  await closed();
  assert.equal(document.querySelector(".hidden-link-note"), null);
  fireEvent.click(edit("navFaq"));
  fireEvent.click(toggle());
  fireEvent.click(button("Save changes"));
  await closed();
  assert.equal(records.navFaq.value.visible, false);
  assert.equal(document.querySelectorAll(".hidden-link-note").length, 3);

  fireEvent.click(button("Preview website"));
  await waitFor(() => assert.equal(faqLinks().length, 0));
  fireEvent.click(button("Edit mode"));
  await waitFor(() => assert.ok(edit("navFaq")));
  fireEvent.click(edit("navFaq"));
  assert.equal(toggle().checked, false);
  fireEvent.click(toggle());
  fireEvent.click(button("Save changes"));
  await closed();
  fireEvent.click(button("Preview website"));
  await waitFor(() =>
    assert.equal(button("Edit mode")?.textContent, "Edit mode"),
  );
  assert.equal(faqLinks().length, 3);
  app.unmount();
});

test("current-page navigation follows the edited destination across desktop, mobile and footer", async () => {
  dom.reconfigure({ url: "http://localhost/services/?from=footer" });
  const app = render(React.createElement(App));
  try {
    await waitFor(() => assert.ok(edit("navServices")));
    const current = () => [
      ...document.querySelectorAll('a[aria-current="page"]'),
    ];
    assert.equal(current().length, 3);
    assert.ok(current().every((link) => link.textContent === "Services"));
    fireEvent.click(edit("navServices"));
    const destination = screen.getByLabelText(/Link destination/);
    fireEvent.change(destination, {
      target: { value: "https://example.com/services" },
    });
    assert.equal(current().length, 0);
    fireEvent.change(destination, {
      target: { value: "/services?category=events" },
    });
    assert.equal(current().length, 3);
  } finally {
    app.unmount();
    dom.reconfigure({ url: "http://localhost/" });
  }
});

test("sign-in waits for gallery navigation without showing the change password form", async () => {
  dom.reconfigure({ url: "http://localhost/admin" });
  const originalLocation = globalThis.location;
  const originalFetch = globalThis.fetch;
  const redirects = [];
  let resolveLogin;
  const login = new Promise((resolve) => (resolveLogin = resolve));
  globalThis.location = {
    href: originalLocation.href,
    origin: originalLocation.origin,
    pathname: originalLocation.pathname,
    replace: (url) => redirects.push(url),
  };
  globalThis.fetch = async (url, options) => {
    if (url === "/api/session") return Response.json({});
    if (url === "/api/login") return login;
    return originalFetch(url, options);
  };
  const app = render(React.createElement(App));
  try {
    const signIn = await screen.findByRole("button", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Local test password" },
    });
    fireEvent.click(signIn);
    assert.equal(signIn.disabled, true);
    assert.deepEqual(redirects, []);
    await React.act(async () => {
      resolveLogin(Response.json({ email: "test@example.test", csrf: "test-token" }));
    });
    assert.deepEqual(redirects, ["/gallery"]);
    assert.equal(screen.queryByRole("heading", { name: "Change password" }), null);
    assert.equal(screen.getByRole("button", { name: "Signing in…" }).disabled, true);
  } finally {
    app.unmount();
    globalThis.location = originalLocation;
    globalThis.fetch = originalFetch;
    dom.reconfigure({ url: "http://localhost/" });
  }
});

test("the change password page masks both new passwords and toggles them independently", async () => {
  dom.reconfigure({ url: "http://localhost/admin" });
  const app = render(React.createElement(App));
  try {
    assert.equal(screen.queryByRole("button", { name: "Sign in" }), null);
    const password = await screen.findByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");
    const current = screen.getByLabelText("Current password");
    assert.equal(password.type, "password");
    assert.equal(confirmation.type, "password");

    const value = "Local test password";
    fireEvent.change(password, { target: { value } });
    fireEvent.change(confirmation, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
    assert.equal(password.type, "text");
    assert.equal(confirmation.type, "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password confirmation" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide new password" }));
    assert.equal(password.type, "password");
    assert.equal(confirmation.type, "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password confirmation" }));
    assert.equal(confirmation.type, "password");
    assert.equal(current.type, "password");
    assert.equal(password.value, value);
    assert.equal(confirmation.value, value);
  } finally {
    app.unmount();
    dom.reconfigure({ url: "http://localhost/" });
  }
});
