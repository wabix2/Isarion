import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySvixSignature } from "./svix-verify";

const secret = "whsec_" + Buffer.from("super-secret-key").toString("base64");
const body = JSON.stringify({ type: "user.created", data: { id: "user_1" } });
const now = 1_700_000_000_000;
const ts = String(now / 1000);
const sign = (id: string, t: string, b: string) =>
  "v1," +
  createHmac("sha256", Buffer.from("super-secret-key"))
    .update(`${id}.${t}.${b}`)
    .digest("base64");

test("accepts a valid signature", () => {
  assert.equal(
    verifySvixSignature(body, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, secret, { nowMs: now }),
    true,
  );
});

test("accepts when one of several signatures matches", () => {
  const sig = `v1,AAAA ${sign("msg_1", ts, body)}`;
  assert.equal(verifySvixSignature(body, { id: "msg_1", timestamp: ts, signature: sig }, secret, { nowMs: now }), true);
});

test("rejects tampered body, bad signature, missing headers and stale timestamps", () => {
  const good = sign("msg_1", ts, body);
  assert.equal(verifySvixSignature(body + " ", { id: "msg_1", timestamp: ts, signature: good }, secret, { nowMs: now }), false);
  assert.equal(verifySvixSignature(body, { id: "msg_1", timestamp: ts, signature: "v1,AAAA" }, secret, { nowMs: now }), false);
  assert.equal(verifySvixSignature(body, {}, secret, { nowMs: now }), false);
  assert.equal(verifySvixSignature(body, { id: "msg_1", timestamp: ts, signature: good }, secret, { nowMs: now + 3_600_000 }), false);
});
