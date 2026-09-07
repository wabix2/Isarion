/**
 * The production API must be supplied explicitly through EAS/Replit
 * environment configuration. The domain fallback exists only for the
 * existing Replit development workflow.
 */
const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const developmentDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();

export const API_BASE = (
  explicitApiUrl ||
  (developmentDomain ? `https://${developmentDomain}` : "")
).replace(/\/+$/, "");