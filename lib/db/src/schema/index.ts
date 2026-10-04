import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── User Progress ───────────────────────────────────────────────────────────

export const userProgressTable = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull().default("Scholar"),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak: integer("streak").notNull().default(0),
  streakFreezes: integer("streak_freezes").notNull().default(1),
  totalQuizzes: integer("total_quizzes").notNull().default(0),
  totalFeynmanSessions: integer("total_feynman_sessions").notNull().default(0),
  feynmanSessionsToday: integer("feynman_sessions_today").notNull().default(0),
  lastActiveDate: text("last_active_date").notNull().default(""),
  subjects: jsonb("subjects").$type<string[]>().notNull().default([]),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(10),
  skillProgress: jsonb("skill_progress").$type<Record<string, number>>().notNull().default({}),
  isOnboarded: boolean("is_onboarded").notNull().default(false),
  referralCode: text("referral_code").unique(),
  referralCount: integer("referral_count").notNull().default(0),
  referralRewardGranted: boolean("referral_reward_granted").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserProgressSchema = createInsertSchema(userProgressTable).omit({ id: true, updatedAt: true });
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserProgress = typeof userProgressTable.$inferSelect;

export const referralCodesTable = pgTable(
  "referral_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    ownerClerkUserId: text("owner_clerk_user_id").notNull().unique(),
    referralCount: integer("referral_count").notNull().default(0),
    rewardGranted: boolean("reward_granted").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    owner: index("referral_codes_owner_idx").on(table.ownerClerkUserId),
  }),
);

export const referralRedemptionsTable = pgTable(
  "referral_redemptions",
  {
    id: serial("id").primaryKey(),
    referralCode: text("referral_code").notNull(),
    referrerClerkUserId: text("referrer_clerk_user_id").notNull(),
    referredClerkUserId: text("referred_clerk_user_id").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    code: index("referral_redemptions_code_idx").on(table.referralCode),
    referrer: index("referral_redemptions_referrer_idx").on(table.referrerClerkUserId),
  }),
);

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export const leaderboardTable = pgTable("leaderboard", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak: integer("streak").notNull().default(0),
  totalQuizzes: integer("total_quizzes").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeaderboardSchema = createInsertSchema(leaderboardTable).omit({ id: true, updatedAt: true });
export type InsertLeaderboard = z.infer<typeof insertLeaderboardSchema>;
export type Leaderboard = typeof leaderboardTable.$inferSelect;

// ─── Learner model ──────────────────────────────────────────────────────────
//
// skillId is the stable client/backend concept key (for example "Biology:0").
// subject is denormalized for fast recommendation filtering.
export const learnerMasteryTable = pgTable(
  "learner_mastery",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    skillId: text("skill_id").notNull(),
    subject: text("subject"),
    masteryScore: real("mastery_score").notNull().default(0),
    confidence: real("confidence").notNull().default(0),
    label: text("label").notNull().default("new"),
    weakAreas: jsonb("weak_areas").$type<string[]>().notNull().default([]),
    misconceptions: jsonb("misconceptions").$type<string[]>().notNull().default([]),
    correctCount: integer("correct_count").notNull().default(0),
    incorrectCount: integer("incorrect_count").notNull().default(0),
    recentPerformance: jsonb("recent_performance").$type<number[]>().notNull().default([]),
    topicStrengths: jsonb("topic_strengths").$type<string[]>().notNull().default([]),
    topicWeaknesses: jsonb("topic_weaknesses").$type<string[]>().notNull().default([]),
    dueReviewAt: timestamp("due_review_at"),
    evidenceCount: integer("evidence_count").notNull().default(0),
    lastUpdated: timestamp("last_updated").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    ownerSkill: uniqueIndex("learner_mastery_owner_skill_idx").on(
      table.clerkUserId,
      table.skillId,
    ),
    owner: index("learner_mastery_user_idx").on(table.clerkUserId),
    subject: index("learner_mastery_subject_idx").on(table.subject),
    dueReview: index("learner_mastery_due_review_idx").on(table.dueReviewAt),
  }),
);

export const learnerEvidenceTable = pgTable(
  "learner_evidence",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    clientEventId: text("client_event_id"),
    skillId: text("skill_id").notNull(),
    subject: text("subject"),
    evidenceType: text("evidence_type").notNull(),
    score: real("score").notNull(),
    confidence: real("confidence"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ownerEvent: uniqueIndex("learner_evidence_owner_event_idx").on(
      table.clerkUserId,
      table.clientEventId,
    ),
    owner: index("learner_evidence_user_idx").on(table.clerkUserId),
    concept: index("learner_evidence_skill_idx").on(table.skillId),
    type: index("learner_evidence_type_idx").on(table.evidenceType),
    created: index("learner_evidence_created_idx").on(table.createdAt),
  }),
);

export type LearnerMastery = typeof learnerMasteryTable.$inferSelect;
export type LearnerEvidence = typeof learnerEvidenceTable.$inferSelect;

// ─── Misconceptions and prerequisite graph ──────────────────────────────────

export const learnerMisconceptionTable = pgTable(
  "learner_misconceptions",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    skillId: text("skill_id").notNull(),
    misconceptionType: text("misconception_type").notNull(),
    severity: text("severity").notNull().default("moderate"),
    evidenceCount: integer("evidence_count").notNull().default(0),
    examples: jsonb("examples").$type<string[]>().notNull().default([]),
    firstDetectedAt: timestamp("first_detected_at").notNull().defaultNow(),
    lastDetectedAt: timestamp("last_detected_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    ownerSkillType: uniqueIndex("learner_misconception_owner_skill_type_idx").on(
      table.clerkUserId,
      table.skillId,
      table.misconceptionType,
    ),
    owner: index("learner_misconception_user_idx").on(table.clerkUserId),
    skill: index("learner_misconception_skill_idx").on(table.skillId),
  }),
);

export const conceptPrerequisiteTable = pgTable(
  "concept_prerequisites",
  {
    id: serial("id").primaryKey(),
    subject: text("subject").notNull(),
    conceptId: text("concept_id").notNull(),
    prerequisiteId: text("prerequisite_id").notNull(),
    reason: text("reason").notNull().default("Build this foundation first."),
  },
  (table) => ({
    conceptPrerequisite: uniqueIndex("concept_prerequisite_pair_idx").on(
      table.subject,
      table.conceptId,
      table.prerequisiteId,
    ),
    subjectConcept: index("concept_prerequisites_subject_concept_idx").on(
      table.subject,
      table.conceptId,
    ),
  }),
);

export const knowledgeObjectTable = pgTable(
  "knowledge_objects",
  {
    id: serial("id").primaryKey(),
    conceptId: text("concept_id").notNull(),
    subject: text("subject"),
    topic: text("topic"),
    normalizedQuestion: text("normalized_question").notNull(),
    explanation: text("explanation").notNull(),
    examples: jsonb("examples").$type<string[]>().notNull().default([]),
    misconceptions: jsonb("misconceptions").$type<string[]>().notNull().default([]),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    difficulty: text("difficulty").notNull().default("unknown"),
    source: text("source").notNull().default("gemini"),
    confidence: real("confidence").notNull().default(0),
    qualityScore: real("quality_score").notNull().default(0),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    normalized: index("knowledge_objects_normalized_question_idx").on(table.normalizedQuestion),
    subjectTopic: index("knowledge_objects_subject_topic_idx").on(table.subject, table.topic),
    quality: index("knowledge_objects_quality_idx").on(table.qualityScore),
  }),
);

export type LearnerMisconception = typeof learnerMisconceptionTable.$inferSelect;
export type ConceptPrerequisite = typeof conceptPrerequisiteTable.$inferSelect;
export type KnowledgeObject = typeof knowledgeObjectTable.$inferSelect;

// ─── Answer reports ─────────────────────────────────────────────────────────
//
// Learners can flag a tutor answer as wrong/confusing. Reports are kept for
// review and also lower the quality score of any matching cached answer so
// it stops being reused.

export const answerReportsTable = pgTable(
  "answer_reports",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    reason: text("reason").notNull().default("incorrect"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    owner: index("answer_reports_owner_idx").on(table.clerkUserId),
  }),
);

// ─── Weekly leagues ─────────────────────────────────────────────────────────
//
// One row per user per week (weekStart = Monday, UTC, YYYY-MM-DD). Users are
// grouped by tier and group_id; weeklyXp is earned XP for that week only.
// `result` records how the user moved when entering the week
// (promoted | demoted | stayed).

export const leagueMembersTable = pgTable(
  "league_members",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    weekStart: text("week_start").notNull(),
    tier: integer("tier").notNull().default(0),
    groupId: integer("group_id").notNull().default(1),
    weeklyXp: integer("weekly_xp").notNull().default(0),
    lastTotalXp: integer("last_total_xp").notNull().default(0),
    result: text("result"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userWeek: uniqueIndex("league_members_user_week_idx").on(table.clerkUserId, table.weekStart),
    group: index("league_members_group_idx").on(table.weekStart, table.tier, table.groupId),
  }),
);
