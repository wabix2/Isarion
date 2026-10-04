CREATE TABLE IF NOT EXISTS "learner_misconceptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL,
  "skill_id" text NOT NULL,
  "misconception_type" text NOT NULL,
  "severity" text DEFAULT 'moderate' NOT NULL,
  "evidence_count" integer DEFAULT 0 NOT NULL,
  "examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "first_detected_at" timestamp DEFAULT now() NOT NULL,
  "last_detected_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_misconception_owner_skill_type_idx"
  ON "learner_misconceptions" ("clerk_user_id", "skill_id", "misconception_type");
CREATE INDEX IF NOT EXISTS "learner_misconception_user_idx"
  ON "learner_misconceptions" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "learner_misconception_skill_idx"
  ON "learner_misconceptions" ("skill_id");

CREATE TABLE IF NOT EXISTS "concept_prerequisites" (
  "id" serial PRIMARY KEY NOT NULL,
  "subject" text NOT NULL,
  "concept_id" text NOT NULL,
  "prerequisite_id" text NOT NULL,
  "reason" text DEFAULT 'Build this foundation first.' NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "concept_prerequisite_pair_idx"
  ON "concept_prerequisites" ("subject", "concept_id", "prerequisite_id");
CREATE INDEX IF NOT EXISTS "concept_prerequisites_subject_concept_idx"
  ON "concept_prerequisites" ("subject", "concept_id");
INSERT INTO "concept_prerequisites" ("subject", "concept_id", "prerequisite_id", "reason")
VALUES
  ('Math', 'quadratic_equations', 'factoring', 'Factoring is a prerequisite for solving many quadratics.'),
  ('Math', 'derivatives', 'functions', 'Functions are the foundation for understanding derivatives.'),
  ('Biology', 'cell_division', 'cell_structure', 'Cell structures must be understood before division.'),
  ('Biology', 'photosynthesis', 'cell_structure', 'Chloroplast and cell structure knowledge supports photosynthesis.'),
  ('Chemistry', 'acid_base_reactions', 'moles', 'Mole relationships support quantitative acid-base work.'),
  ('History', 'french_revolution', 'enlightenment', 'Enlightenment ideas explain the revolution''s causes.')
ON CONFLICT ("subject", "concept_id", "prerequisite_id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "knowledge_objects" (
  "id" serial PRIMARY KEY NOT NULL,
  "concept_id" text NOT NULL,
  "subject" text,
  "topic" text,
  "normalized_question" text NOT NULL,
  "explanation" text NOT NULL,
  "examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "misconceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "difficulty" text DEFAULT 'unknown' NOT NULL,
  "source" text DEFAULT 'gemini' NOT NULL,
  "confidence" real DEFAULT 0 NOT NULL,
  "quality_score" real DEFAULT 0 NOT NULL,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "knowledge_objects_normalized_question_idx"
  ON "knowledge_objects" ("normalized_question");
CREATE INDEX IF NOT EXISTS "knowledge_objects_subject_topic_idx"
  ON "knowledge_objects" ("subject", "topic");
CREATE INDEX IF NOT EXISTS "knowledge_objects_quality_idx"
  ON "knowledge_objects" ("quality_score");

ALTER TABLE "learner_mastery"
  ADD COLUMN IF NOT EXISTS "correct_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "incorrect_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "recent_performance" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "topic_strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "topic_weaknesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_updated" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "user_progress"
  ADD COLUMN IF NOT EXISTS "total_feynman_sessions" integer DEFAULT 0 NOT NULL;