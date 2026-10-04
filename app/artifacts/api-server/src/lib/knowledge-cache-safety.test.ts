import test from "node:test";
import assert from "node:assert/strict";
import { isSafeReusableContent, stripPrivateContent } from "./knowledge-cache-safety";

test("shared knowledge content strips private fields before storage", () => {
  const sanitized = stripPrivateContent(
    "My name is Dana. Email dana@example.com. My phone is +1 (555) 123-4567. Photosynthesis uses light.",
  );
  assert.equal(sanitized.includes("dana@example.com"), false);
  assert.equal(sanitized.includes("555"), false);
  assert.equal(sanitized.includes("My name is"), false);
  assert.equal(isSafeReusableContent(sanitized), true);
});

test("cache rejects personal content that was not safely scrubbed", () => {
  assert.equal(isSafeReusableContent("Please email me at private@example.com"), false);
  assert.equal(isSafeReusableContent("Call me Alex about this concept"), false);
});