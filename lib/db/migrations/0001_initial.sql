CREATE TABLE IF NOT EXISTS "user_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "name" text DEFAULT 'Scholar' NOT NULL,
  "xp" integer DEFAULT 0 NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "streak" integer DEFAULT 0 NOT NULL,
  "streak_freezes" integer DEFAULT 1 NOT NULL,
  "total_quizzes" integer DEFAULT 0 NOT NULL,
  "feynman_sessions_today" integer DEFAULT 0 NOT NULL,
  "last_active_date" text DEFAULT '' NOT NULL,
  "subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "daily_goal_minutes" integer DEFAULT 10 NOT NULL,
  "skill_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_onboarded" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "leaderboard" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "xp" integer DEFAULT 0 NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "streak" integer DEFAULT 0 NOT NULL,
  "total_quizzes" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "learner_mastery" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL,
  "skill_id" text NOT NULL,
  "subject" text,
  "mastery_score" real DEFAULT 0 NOT NULL,
  "confidence" real DEFAULT 0 NOT NULL,
  "label" text DEFAULT 'new' NOT NULL,
  "weak_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "misconceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "due_review_at" timestamp,
  "evidence_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_mastery_owner_skill_idx"
  ON "learner_mastery" ("clerk_user_id", "skill_id");
CREATE INDEX IF NOT EXISTS "learner_mastery_user_idx"
  ON "learner_mastery" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "learner_mastery_subject_idx"
  ON "learner_mastery" ("subject");
CREATE INDEX IF NOT EXISTS "learner_mastery_due_review_idx"
  ON "learner_mastery" ("due_review_at");

CREATE TABLE IF NOT EXISTS "learner_evidence" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL,
  "client_event_id" text,
  "skill_id" text NOT NULL,
  "subject" text,
  "evidence_type" text NOT NULL,
  "score" real NOT NULL,
  "confidence" real,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_evidence_owner_event_idx"
  ON "learner_evidence" ("clerk_user_id", "client_event_id");
CREATE INDEX IF NOT EXISTS "learner_evidence_user_idx"
  ON "learner_evidence" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "learner_evidence_skill_idx"
  ON "learner_evidence" ("skill_id");
CREATE INDEX IF NOT EXISTS "learner_evidence_type_idx"
  ON "learner_evidence" ("evidence_type");
CREATE INDEX IF NOT EXISTS "learner_evidence_created_idx"
  ON "learner_evidence" ("created_at");