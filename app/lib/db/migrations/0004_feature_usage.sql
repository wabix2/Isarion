CREATE TABLE IF NOT EXISTS "feature_usage" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL,
  "feature" text NOT NULL,
  "usage_date" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "feature_usage_owner_feature_date_idx"
  ON "feature_usage" ("clerk_user_id", "feature", "usage_date");