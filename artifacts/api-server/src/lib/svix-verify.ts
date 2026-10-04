import { createHmac, timingSafeEqual } from "node:crypto";

export interface SvixHeaders {
  id?: string;
  timestamp?: string;
  signature?: string;
}

/**
 * Verifies a Svix-signed webhook (the scheme Clerk uses) with Node's crypto.
 * Signed content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 with the
 * base64-decoded part of the `whsec_...` secret. The signature header holds
 * space-separated `v1,<base64>` entries; any match is valid.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
  opts: { toleranceSeconds?: number; nowMs?: number } = {},
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const tolerance = opts.toleranceSeconds ?? 300;
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > tolerance) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      return true;
    }
  }
  return false;
}
