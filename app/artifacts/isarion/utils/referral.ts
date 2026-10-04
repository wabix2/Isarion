const PUBLIC_APP_URL = "https://wabix2.github.io/Launchpad";

/**
 * Referral codes are identifiers, not credentials. They are intentionally
 * short and stable for the lifetime of a local account.
 */
export function makeReferralCode(userId: string | null | undefined): string {
  const seed =
    userId ||
    `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ISAR-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

export function getInviteLink(referralCode: string): string {
  const code = encodeURIComponent(referralCode.trim().toUpperCase());
  return `${PUBLIC_APP_URL}/invite/${code}`;
}