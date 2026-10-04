import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  learnerEvidenceTable,
  learnerMasteryTable,
  learnerMisconceptionTable,
} from "@workspace/db/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getPrerequisites } from "../lib/prerequisites";

const router: IRouter = Router();
const MISCONCEPTION_THRESHOLD = 3;
const MAX_FREE_EVIDENCE_PER_DAY = 100;

const EvidenceSchema = z.object({
  eventId: z.string().trim().min(1).max(160).optional(),
  evidenceType: z.enum(["quiz", "flashcard", "feynman"]),
  skillId: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(100).optional(),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
  correct: z.number().int().min(0).max(1000).optional(),
  total: z.number().int().min(1).max(1000).optional(),
  misconception: z.string().trim().max(500).optional(),
  weakAreas: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  response: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, ctx) => {
  if (value.total !== undefined && value.correct !== undefined && value.correct > value.total) {
    ctx.addIssue({ code: "custom", path: ["correct"], message: "correct cannot exceed total" });
  }
});

function isPro(claims: Record<string, unknown>): boolean {
  const read = (value: unknown): boolean =>
    value === true || value === "true";
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

function masteryLabel(score: number): string {
  if (score >= 0.8) return "mastered";
  if (score >= 0.6) return "proficient";
  if (score >= 0.3) return "developing";
  return "new";
}

function nextReview(score: number): Date {
  const days = score >= 0.8 ? 14 : score >= 0.6 ? 4 : 1;
  return new Date(Date.now() + days * 86_400_000);
}

type EvidenceInput = z.infer<typeof EvidenceSchema>;

function baseEvidenceWeight(type: EvidenceInput["evidenceType"]): number {
  return type === "quiz" ? 0.18 : type === "feynman" ? 0.16 : 0.12;
}

/**
 * Deterministic learner update:
 *   delta = clamp((eventScore - priorScore) * typeWeight, -0.20, +0.20)
 *   newScore = clamp(priorScore + delta, 0, 1)
 *   confidence = 1 - exp(-evidenceCount / 10)
 *
 * Quiz evidence is weighted most because it has an objective answer key.
 * The delta cap prevents one unusually good or bad event from causing a
 * large mastery jump. Recent performance and counts remain traceable.
 */
export function updateMastery(
  previous: typeof learnerMasteryTable.$inferSelect | undefined,
  evidence: z.infer<typeof EvidenceSchema>,
) {
  const priorScore = previous?.masteryScore ?? 0;
  const priorCount = previous?.evidenceCount ?? 0;
  const weight = baseEvidenceWeight(evidence.evidenceType);
  const delta = Math.max(-0.2, Math.min(0.2, (evidence.score - priorScore) * weight));
  const score = Math.max(0, Math.min(1, priorScore + delta));
  const correct = evidence.correct ?? (evidence.score >= 0.5 ? 1 : 0);
  const total = evidence.total ?? 1;
  const incorrect = Math.max(0, total - correct);
  const recentPerformance = [
    ...(previous?.recentPerformance ?? []),
    evidence.score,
  ].slice(-10);
  const weakAreas = Array.from(new Set([
    ...(previous?.weakAreas ?? []),
    ...evidence.weakAreas,
  ])).slice(-20);
  const topicWeaknesses = score < 0.6
    ? Array.from(new Set([...(previous?.topicWeaknesses ?? []), evidence.skillId])).slice(-20)
    : (previous?.topicWeaknesses ?? []).filter((item) => item !== evidence.skillId);
  const topicStrengths = score >= 0.8
    ? Array.from(new Set([...(previous?.topicStrengths ?? []), evidence.skillId])).slice(-20)
    : (previous?.topicStrengths ?? []).filter((item) => item !== evidence.skillId);
  const evidenceCount = priorCount + 1;

  return {
    score,
    confidence: 1 - Math.exp(-evidenceCount / 10),
    evidenceCount,
    correctCount: (previous?.correctCount ?? 0) + correct,
    incorrectCount: (previous?.incorrectCount ?? 0) + incorrect,
    recentPerformance,
    weakAreas,
    topicStrengths,
    topicWeaknesses,
  };
}

function safeMetadata(metadata: Record<string, unknown>): Record<string, string | number | boolean> {
  const allowed = ["questionId", "concept", "difficulty", "source"];
  return Object.fromEntries(
    allowed
      .filter((key) => typeof metadata[key] === "string" || typeof metadata[key] === "number" || typeof metadata[key] === "boolean")
      .map((key) => [key, metadata[key] as string | number | boolean]),
  );
}

function errorPattern(evidence: z.infer<typeof EvidenceSchema>): string | null {
  const incorrect = evidence.total !== undefined && evidence.correct !== undefined
    ? evidence.total - evidence.correct
    : evidence.score < 0.6 ? 1 : 0;
  if (incorrect <= 0 && evidence.score >= 0.6) return null;
  return evidence.misconception?.toLowerCase().trim().slice(0, 500)
    || `${evidence.evidenceType}:repeated-low-score`;
}

function severityFor(count: number, score: number): string {
  if (count >= 5 || score < 0.3) return "high";
  if (count >= 3) return "moderate";
  return "low";
}

async function recordMisconception(
  userId: string,
  evidence: z.infer<typeof EvidenceSchema>,
): Promise<typeof learnerMisconceptionTable.$inferSelect | null> {
  const pattern = errorPattern(evidence);
  if (!pattern) return null;
  const recent = await db
    .select()
    .from(learnerEvidenceTable)
    .where(and(
      eq(learnerEvidenceTable.clerkUserId, userId),
      eq(learnerEvidenceTable.skillId, evidence.skillId),
    ))
    .orderBy(desc(learnerEvidenceTable.createdAt))
    .limit(20);
  const similarErrors = recent.filter((item) => {
    const payload = item.payload as Record<string, unknown>;
    const total = typeof payload.total === "number" ? payload.total : 0;
    const correct = typeof payload.correct === "number" ? payload.correct : total;
    const wasWrong = item.score < 0.6 || (total > 0 && correct < total);
    return wasWrong &&
      (payload.misconceptionType === pattern || !evidence.misconception);
  }).length;
  if (similarErrors < MISCONCEPTION_THRESHOLD) return null;

  const existing = await db
    .select()
    .from(learnerMisconceptionTable)
    .where(and(
      eq(learnerMisconceptionTable.clerkUserId, userId),
      eq(learnerMisconceptionTable.skillId, evidence.skillId),
      eq(learnerMisconceptionTable.misconceptionType, pattern),
    ))
    .limit(1);
  const examples = Array.from(new Set([
    ...(existing[0]?.examples ?? []),
    `${evidence.evidenceType} score ${Math.round(evidence.score * 100)}%`,
  ])).slice(-5);
  const data = {
    clerkUserId: userId,
    skillId: evidence.skillId,
    misconceptionType: pattern,
    severity: severityFor(similarErrors, evidence.score),
    evidenceCount: similarErrors,
    examples,
    lastDetectedAt: new Date(),
    resolvedAt: null,
  };
  if (existing[0]) {
    await db
      .update(learnerMisconceptionTable)
      .set(data)
      .where(eq(learnerMisconceptionTable.id, existing[0].id));
    return { ...existing[0], ...data };
  }
  const [created] = await db.insert(learnerMisconceptionTable).values(data).returning();
  return created ?? null;
}

function buildRecommendation(
  candidate: typeof learnerMasteryTable.$inferSelect,
  pro: boolean,
  misconception?: typeof learnerMisconceptionTable.$inferSelect,
  prerequisite?: { prerequisiteId: string; reason: string },
) {
  const conceptId = prerequisite?.prerequisiteId ?? candidate.skillId;
  const due = candidate.dueReviewAt ? candidate.dueReviewAt <= new Date() : true;
  const mode = candidate.masteryScore < 0.6 ? "quiz" : "flashcard";
  const reason = prerequisite
    ? prerequisite.reason
    : misconception
      ? `You have repeated ${misconception.misconceptionType} errors (${misconception.evidenceCount} examples).`
      : due
        ? `${candidate.label} mastery is due for review.`
        : "Your confidence is still building in this skill.";
  return {
    recommendation: {
      type: "practice",
      conceptId,
      title: prerequisite ? `Build ${conceptId} first` : due ? `Review ${candidate.skillId}` : `Strengthen ${candidate.skillId}`,
      reason,
      action: mode === "quiz" ? "Start a quiz" : "Review flashcards",
      skillId: conceptId,
      mode,
      estimatedMinutes: mode === "quiz" ? 8 : 5,
    },
    proDetail: pro
      ? {
          masteryScore: candidate.masteryScore,
          confidence: candidate.confidence,
          weakAreas: candidate.weakAreas,
          misconceptions: candidate.misconceptions,
          dueReviewAt: candidate.dueReviewAt?.toISOString() ?? null,
          correctCount: candidate.correctCount,
          incorrectCount: candidate.incorrectCount,
          recentPerformance: candidate.recentPerformance,
          topicStrengths: candidate.topicStrengths,
          topicWeaknesses: candidate.topicWeaknesses,
        }
      : null,
  };
}

function toMasteryResponse(row: typeof learnerMasteryTable.$inferSelect, evidence?: unknown[]) {
  return {
    skillId: row.skillId,
    subject: row.subject,
    masteryScore: row.masteryScore,
    confidence: row.confidence,
    label: row.label,
    weakAreas: row.weakAreas,
    misconceptions: row.misconceptions,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    recentPerformance: row.recentPerformance,
    topicStrengths: row.topicStrengths,
    topicWeaknesses: row.topicWeaknesses,
    lastUpdated: row.lastUpdated.toISOString(),
    dueReviewAt: row.dueReviewAt?.toISOString() ?? null,
    evidenceCount: row.evidenceCount,
    ...(evidence === undefined ? {} : { evidence }),
  };
}

router.get("/mastery", requireAuth, async (req, res) => {
  const { userId, claims } = req.auth!;
  const rawIncludeEvidence = req.query.includeEvidence;
  if (rawIncludeEvidence !== undefined && rawIncludeEvidence !== "true" && rawIncludeEvidence !== "false") {
    res.status(400).json({ error: "includeEvidence must be true or false." });
    return;
  }
  const includeEvidence = rawIncludeEvidence === "true";
  if (includeEvidence && !isPro(claims)) {
    res.status(403).json({ error: "Evidence detail is available to Pro learners.", code: "PRO_REQUIRED" });
    return;
  }
  try {
    const mastery = await db
      .select()
      .from(learnerMasteryTable)
      .where(eq(learnerMasteryTable.clerkUserId, userId))
      .orderBy(asc(learnerMasteryTable.masteryScore));
    const evidenceBySkill = new Map<string, unknown[]>();
    if (includeEvidence && mastery.length > 0) {
      const evidence = await db
        .select()
        .from(learnerEvidenceTable)
        .where(eq(learnerEvidenceTable.clerkUserId, userId))
        .orderBy(desc(learnerEvidenceTable.createdAt))
        .limit(500);
      for (const item of evidence) {
        const list = evidenceBySkill.get(item.skillId) ?? [];
        list.push({
          id: item.id,
          evidenceType: item.evidenceType,
          score: item.score,
          confidence: item.confidence,
          createdAt: item.createdAt.toISOString(),
          payload: item.payload,
        });
        evidenceBySkill.set(item.skillId, list);
      }
    }
    res.json({
      items: mastery.map((row) => toMasteryResponse(row, includeEvidence ? evidenceBySkill.get(row.skillId) ?? [] : undefined)),
      total: mastery.length,
      includeEvidence,
      pro: isPro(claims),
    });
  } catch (error) {
    req.log?.error({ error }, "mastery GET error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/misconceptions", requireAuth, async (req, res) => {
  const { userId } = req.auth!;
  try {
    const rows = await db
      .select()
      .from(learnerMisconceptionTable)
      .where(and(eq(learnerMisconceptionTable.clerkUserId, userId), isNull(learnerMisconceptionTable.resolvedAt)))
      .orderBy(desc(learnerMisconceptionTable.evidenceCount));
    res.json({ items: rows, total: rows.length });
  } catch (error) {
    req.log?.error({ error }, "misconceptions GET error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/next-best-action", requireAuth, async (req, res) => {
  const { userId, claims } = req.auth!;
  const subject = typeof req.query.subject === "string" ? req.query.subject.trim().slice(0, 100) : undefined;
  try {
    const filters = [eq(learnerMasteryTable.clerkUserId, userId)];
    if (subject) filters.push(eq(learnerMasteryTable.subject, subject));
    const mastery = await db
      .select()
      .from(learnerMasteryTable)
      .where(and(...filters))
      .orderBy(asc(learnerMasteryTable.masteryScore), asc(learnerMasteryTable.confidence));
    if (!mastery.length) {
      res.json({ recommendation: null, proDetail: null, hasLearnerData: false });
      return;
    }
    const misconceptions = await db
      .select()
      .from(learnerMisconceptionTable)
      .where(and(eq(learnerMisconceptionTable.clerkUserId, userId), isNull(learnerMisconceptionTable.resolvedAt)));
    const candidate = mastery.find((row) =>
      misconceptions.some((item) => item.skillId === row.skillId),
    ) ?? mastery[0];
    const misconception = misconceptions.find((item) => item.skillId === candidate.skillId);
    const prereq = (await getPrerequisites(candidate.subject, candidate.skillId))[0];
    const prerequisiteMastery = prereq
      ? mastery.find((row) => row.skillId === prereq.prerequisiteId)
      : undefined;
    const prerequisiteToPractice = prereq && (!prerequisiteMastery || prerequisiteMastery.masteryScore < candidate.masteryScore)
      ? prereq
      : undefined;
    res.json({
      ...buildRecommendation(candidate, isPro(claims), misconception, prerequisiteToPractice),
      hasLearnerData: true,
    });
  } catch (error) {
    req.log?.error({ error }, "next-best-action GET error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/learning/evidence", requireAuth, async (req, res) => {
  const { userId, claims } = req.auth!;
  const parsed = EvidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const evidence = parsed.data;
  try {
    if (!isPro(claims)) {
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(learnerEvidenceTable)
        .where(and(
          eq(learnerEvidenceTable.clerkUserId, userId),
          sql`${learnerEvidenceTable.createdAt} >= date_trunc('day', now())`,
        ));
      if (Number(count?.count ?? 0) >= MAX_FREE_EVIDENCE_PER_DAY) {
        res.status(429).json({ error: "Daily learner-model limit reached.", code: "FREE_LIMIT_REACHED" });
        return;
      }
    }
    if (evidence.eventId) {
      const [existing] = await db
        .select({ id: learnerEvidenceTable.id, skillId: learnerEvidenceTable.skillId })
        .from(learnerEvidenceTable)
        .where(and(
          eq(learnerEvidenceTable.clerkUserId, userId),
          eq(learnerEvidenceTable.clientEventId, evidence.eventId),
        ))
        .limit(1);
      if (existing) {
        res.status(200).json({ ok: true, duplicate: true, skillId: existing.skillId });
        return;
      }
    }

    const [previous] = await db
      .select()
      .from(learnerMasteryTable)
      .where(and(
        eq(learnerMasteryTable.clerkUserId, userId),
        eq(learnerMasteryTable.skillId, evidence.skillId),
      ))
      .limit(1);
    const updated = updateMastery(previous, evidence);
    const now = new Date();
    const misconceptionType = errorPattern(evidence);
    const payload = {
      correct: evidence.correct,
      total: evidence.total,
      responseLength: evidence.response?.length ?? 0,
      misconceptionType,
      metadata: safeMetadata(evidence.metadata),
    };
    await db.insert(learnerEvidenceTable).values({
      clerkUserId: userId,
      clientEventId: evidence.eventId,
      skillId: evidence.skillId,
      subject: evidence.subject,
      evidenceType: evidence.evidenceType,
      score: evidence.score,
      confidence: evidence.confidence,
      payload,
    });
    const mastery = {
      clerkUserId: userId,
      skillId: evidence.skillId,
      subject: evidence.subject ?? previous?.subject,
      masteryScore: updated.score,
      confidence: updated.confidence,
      label: masteryLabel(updated.score),
      weakAreas: updated.weakAreas,
      misconceptions: previous?.misconceptions ?? [],
      correctCount: updated.correctCount,
      incorrectCount: updated.incorrectCount,
      recentPerformance: updated.recentPerformance,
      topicStrengths: updated.topicStrengths,
      topicWeaknesses: updated.topicWeaknesses,
      dueReviewAt: nextReview(updated.score),
      evidenceCount: updated.evidenceCount,
      lastUpdated: now,
      updatedAt: now,
    };
    await db.insert(learnerMasteryTable).values(mastery).onConflictDoUpdate({
      target: [learnerMasteryTable.clerkUserId, learnerMasteryTable.skillId],
      set: mastery,
    });
    const misconception = await recordMisconception(userId, evidence);
    if (misconception) {
      const nextMisconceptions = Array.from(new Set([
        ...(mastery.misconceptions ?? []),
        misconception.misconceptionType,
      ])).slice(-20);
      await db.update(learnerMasteryTable)
        .set({ misconceptions: nextMisconceptions, updatedAt: now, lastUpdated: now })
        .where(and(
          eq(learnerMasteryTable.clerkUserId, userId),
          eq(learnerMasteryTable.skillId, evidence.skillId),
        ));
    }

    res.status(201).json({
      ok: true,
      duplicate: false,
      misconceptionDetected: Boolean(misconception),
      mastery: {
        skillId: evidence.skillId,
        masteryScore: updated.score,
        confidence: updated.confidence,
        label: masteryLabel(updated.score),
        dueReviewAt: mastery.dueReviewAt.toISOString(),
      },
    });
  } catch (error) {
    req.log?.error({ error }, "learning/evidence POST error");
    res.status(500).json({ error: "Server error" });
  }
});

export {
  EvidenceSchema,
  buildRecommendation,
  isPro,
  masteryLabel,
};
export default router;