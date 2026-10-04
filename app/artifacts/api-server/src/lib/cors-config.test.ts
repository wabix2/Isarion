import test from "node:test";
import assert from "node:assert/strict";
import { buildCorsOptions } from "./cors-config";

function invokeOrigin(
  options: ReturnType<typeof buildCorsOptions>,
  requestOrigin: string | undefined,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const origin = options.origin;
    if (typeof origin !== "function") {
      // Boolean origin (dev fallback) — allowed iff truthy.
      resolve(Boolean(origin));
      return;
    }
    origin(requestOrigin, (err, allow) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(Boolean(allow));
    });
  });
}

test("production requires ALLOWED_ORIGINS to be set", () => {
  assert.throws(() => buildCorsOptions({ NODE_ENV: "production" }));
});

test("development without ALLOWED_ORIGINS falls back to permissive (Expo/local)", async () => {
  const options = buildCorsOptions({ NODE_ENV: "development" });
  assert.equal(options.origin, true);
});

test("production allowlist accepts listed origins and rejects others", async () => {
  const options = buildCorsOptions({
    NODE_ENV: "production",
    ALLOWED_ORIGINS: "https://lumiq.app, https://admin.lumiq.app",
  });
  assert.equal(await invokeOrigin(options, "https://lumiq.app"), true);
  assert.equal(await invokeOrigin(options, "https://admin.lumiq.app"), true);
  assert.equal(await invokeOrigin(options, "https://evil.example"), false);
});

test("requests with no Origin header (server-to-server) are allowed through", async () => {
  const options = buildCorsOptions({
    NODE_ENV: "production",
    ALLOWED_ORIGINS: "https://lumiq.app",
  });
  assert.equal(await invokeOrigin(options, undefined), true);
});
