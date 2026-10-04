import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { learnerMasteryTable, learnerMisconceptionTable } from "@workspace/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { chatLimiter } from "../lib/rate-limit";
import { createAIGateway, AIGatewayError } from "../lib/ai/gateway";
import { consumeQuota } from "../lib/usage-quota";
import { isPro } from "./learner-model";

const router: IRouter = Router();

// Kept in sync by hand with ALL_SUBJECTS in app/(tabs)/study.tsx — same
// convention chat.ts already uses for its own subjectFromTopic() list.
const KNOWN_SUBJECTS = ["Math", "Biology", "Chemistry", "Physics", "History"];

// Kept in sync by hand with PATH_STAGE_TITLES in utils/learningPath.ts.
// Only used to make the prompt read naturally ("Core Concepts" instead of
// "1") — never used for any access-control decision, so drifting out of
// sync would degrade prompt quality, not correctness.
const PATH_STAGE_TITLES = ["Foundations", "Core Concepts", "Practice", "Application", "Mastery Check"];

function stageTitleFromSkillId(skillId: string | undefined): string | undefined {
  if (!skillId) return undefined;
  const stageIndex = Number(skillId.split(":")[1]);
  return Number.isInteger(stageIndex) ? PATH_STAGE_TITLES[stageIndex] : undefined;
}

const QuizRequestSchema = z.object({
  subject: z.enum(KNOWN_SUBJECTS as [string, ...string[]]),
  skillId: z.string().trim().min(1).max(160).optional(),
  count: z.number().int().min(4).max(10).default(8),
});

const QuizResponseSchema = z.object({
  questions: z.array(
    z.object({
      q: z.string().trim().min(1).max(300),
      options: z.array(z.string().trim().min(1).max(120)).length(4),
      answer: z.number().int().min(0).max(3),
    }),
  ).min(1).max(10),
});

router.post("/quiz/generate", requireAuth, chatLimiter, async (req, res) => {
  const parsed = QuizRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { subject, skillId, count } = parsed.data;
  const { userId, claims } = req.auth!;

  // Same convention as /chat: quota is consumed for the attempt, not only
  // on a confirmed success, so a burst of retries against a flaky model
  // response can't be used to get unlimited free generations. Pro users
  // are unlimited (see consumeQuota).
  const quota = await consumeQuota(userId, "quizGenerations", claims);
  if (!quota.allowed) {
    res.status(429).json({
      error: "You've used today's free personalized quizzes. Upgrade to Pro for unlimited, or keep practicing with the standard question set.",
      remaining: quota.remaining,
    });
    return;
  }

  try {
    // Pull whatever learner-model signal exists for this skill (or, if no
    // specific skillId was given, the weakest tracked skill in this
    // subject) so the generated questions actually target real gaps
    // instead of being a random spread. Absence of any row here is
    // expected and fine — a brand-new learner just gets a solid generic
    // quiz for the subject.
    const masteryFilters = skillId
      ? [eq(learnerMasteryTable.clerkUserId, userId), eq(learnerMasteryTable.skillId, skillId)]
      : [eq(learnerMasteryTable.clerkUserId, userId), eq(learnerMasteryTable.subject, subject)];
    const [mastery] = await db
      .select()
      .from(learnerMasteryTable)
      .where(and(...masteryFilters))
      .orderBy(asc(learnerMasteryTable.masteryScore))
      .limit(1);

    const resolvedSkillId = mastery?.skillId ?? skillId;
    let misconceptionTypes: string[] = [];
    if (resolvedSkillId) {
      const misconceptions = await db
        .select({ misconceptionType: learnerMisconceptionTable.misconceptionType })
        .from(learnerMisconceptionTable)
        .where(and(
          eq(learnerMisconceptionTable.clerkUserId, userId),
          eq(learnerMisconceptionTable.skillId, resolvedSkillId),
          isNull(learnerMisconceptionTable.resolvedAt),
        ))
        .limit(5);
      misconceptionTypes = misconceptions.map((row) => row.misconceptionType);
    }

    const gateway = createAIGateway();
    const raw = await gateway.generateQuiz({
      subject,
      stageTitle: stageTitleFromSkillId(resolvedSkillId),
      masteryLabel: mastery?.label,
      weakAreas: mastery?.weakAreas?.slice(-5),
      misconceptions: misconceptionTypes,
      count,
    });

    let quiz: z.infer<typeof QuizResponseSchema>;
    try {
      quiz = QuizResponseSchema.parse(JSON.parse(raw));
    } catch (parseError) {
      req.log?.warn({ parseError, raw: raw.slice(0, 500) }, "quiz/generate: model returned unparseable JSON");
      throw new AIGatewayError("Model did not return a valid quiz.", "generateQuiz", true);
    }

    res.json({
      questions: quiz.questions,
      subject,
      skillId: resolvedSkillId ?? null,
      personalized: Boolean(mastery),
      pro: isPro(claims),
    });
  } catch (error) {
    if (error instanceof AIGatewayError) {
      // 503, not 500: this is a "the model didn't cooperate this time"
      // failure, not a bug, and the client already knows how to fall back
      // to its local question bank on any non-2xx here.
      res.status(503).json({ error: error.message, feature: error.feature });
      return;
    }
    req.log?.error({ error }, "quiz/generate route error");
    res.status(500).json({ error: "Quiz generation failed." });
  }
});

export default router;
