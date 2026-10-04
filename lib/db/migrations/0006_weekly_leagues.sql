CREATE TABLE IF NOT EXISTS "league_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL,
  "week_start" text NOT NULL,
  "tier" integer DEFAULT 0 NOT NULL,
  "group_id" integer DEFAULT 1 NOT NULL,
  "weekly_xp" integer DEFAULT 0 NOT NULL,
  "last_total_xp" integer DEFAULT 0 NOT NULL,
  "result" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "league_members_user_week_idx"
  ON "league_members" ("clerk_user_id", "week_start");
CREATE INDEX IF NOT EXISTS "league_members_group_idx"
  ON "league_members" ("week_start", "tier", "group_id");
