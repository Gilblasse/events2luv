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
