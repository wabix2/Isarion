ALTER TABLE "user_progress"
  ADD COLUMN IF NOT EXISTS "referral_code" text,
  ADD COLUMN IF NOT EXISTS "referral_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "referral_reward_granted" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "referral_codes" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "owner_clerk_user_id" text NOT NULL UNIQUE,
  "referral_count" integer DEFAULT 0 NOT NULL,
  "reward_granted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "referral_codes_owner_idx"
  ON "referral_codes" ("owner_clerk_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "user_progress_referral_code_idx"
  ON "user_progress" ("referral_code")
  WHERE "referral_code" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "referral_redemptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "referral_code" text NOT NULL,
  "referrer_clerk_user_id" text NOT NULL,
  "referred_clerk_user_id" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "referral_redemptions_code_idx"
  ON "referral_redemptions" ("referral_code");
CREATE INDEX IF NOT EXISTS "referral_redemptions_referrer_idx"
  ON "referral_redemptions" ("referrer_clerk_user_id");