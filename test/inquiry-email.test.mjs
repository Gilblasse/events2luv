import test from "node:test";
import assert from "node:assert/strict";
import { inquiryEmail } from "../server/inquiry-email.mjs";

test("both email formats omit hidden rows and empty sections", () => {
  const message = inquiryEmail({ name: "Visible", inspiration: "Private" }, new Set(["name", "phone"]));
  for (const body of [message.text, message.html]) {
    assert.match(body, /Visible/);
    assert.match(body, /Phone/);
    assert.doesNotMatch(body, /Private|Inspiration|Email address|Event details|In their words|Reply to this email/);
  }
});
