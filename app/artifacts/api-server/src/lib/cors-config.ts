import type { CorsOptions } from "cors";

/**
 * buildCorsOptions — restricts cross-origin requests to an explicit allowlist.
 *
 * Reads a comma-separated list of origins from ALLOWED_ORIGINS (e.g.
 * "https://lumiq.app,https://admin.lumiq.app"). In non-production
 * environments, if ALLOWED_ORIGINS is unset, all origins are allowed so
 * local development and Expo Go / tunnelled dev clients keep working.
 * In production, ALLOWED_ORIGINS is required — the server refuses to start
 * wide open.
 */
export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const isProduction = env.NODE_ENV === "production";
  const raw = env.ALLOWED_ORIGINS?.trim();

  if (!raw) {
    if (isProduction) {
      throw new Error(
        "ALLOWED_ORIGINS environment variable is required in production but was not provided.",
      );
    }
    // Local/dev fallback: permissive so Expo dev clients and localhost work.
    return { origin: true, credentials: true };
  }

  const allowlist = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origin: CorsOptions["origin"] = (requestOrigin, callback) => {
    // Allow same-origin / non-browser requests (no Origin header, e.g. curl,
    // server-to-server, some native app requests).
    if (!requestOrigin) {
      callback(null, true);
      return;
    }
    if (allowlist.includes(requestOrigin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin "${requestOrigin}" is not allowed by CORS policy.`));
  };

  return { origin, credentials: true };
}
