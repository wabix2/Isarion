import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { FREE_LIMITS, type FeatureId } from "./feature-limits";

type Claims = Record<string, unknown> | undefined;

export type QuotaResult = {
  allowed: boolean;
  remaining: number | null;
};

function isPro(claims: Claims): boolean {
  if (!claims) return false;
  const read = (value: unknown) => value === true || value === "true";
  const publicMetadata = claims.public_metadata;
  const metadata = claims.metadata;
  return [
    claims.isPro,
    claims.is_pro,
    typeof publicMetadata === "object" && publicMetadata !== null
      ? (publicMetadata as Record<string, unknown>).isPro
      : undefined,
    typeof publicMetadata === "object" && publicMetadata !== null
      ? (publicMetadata as Record<string, unknown>).is_pro
      : undefined,
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>).isPro
      : undefined,
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>).is_pro
      : undefined,
  ].some(read);
}

/**
 * Atomically consume one daily feature allowance. The database constraint is
 * the enforcement point; client-side counters are only UX hints.
 */
export async function consumeQuota(
  userId: string,
  feature: FeatureId,
  claims?: Claims,
): Promise<QuotaResult> {
  if (isPro(claims)) return { allowed: true, remaining: null };

  const limit = FREE_LIMITS[feature];
  const usageDate = new Date().toISOString().slice(0, 10);
  const result = await db.execute(sql`
    INSERT INTO "feature_usage" ("clerk_user_id", "feature", "usage_date", "count")
    VALUES (${userId}, ${feature}, ${usageDate}, 1)
    ON CONFLICT ("clerk_user_id", "feature", "usage_date")
    DO UPDATE SET
      "count" = "feature_usage"."count" + 1,
      "updated_at" = now()
    WHERE "feature_usage"."count" < ${limit}
    RETURNING "count"
  `);

  const row = result.rows[0] as { count?: number | string } | undefined;
  if (!row) return { allowed: false, remaining: 0 };
  const count = Number(row.count ?? 0);
  return { allowed: true, remaining: Math.max(0, limit - count) };
}