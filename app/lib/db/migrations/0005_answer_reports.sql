CREATE TABLE IF NOT EXISTS "answer_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "reason" text DEFAULT 'incorrect' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "answer_reports_owner_idx"
  ON "answer_reports" ("clerk_user_id");
