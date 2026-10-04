import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";
import { db, answerReportsTable, knowledgeObjectTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { normalizeQuestion } from "../lib/knowledge-cache";

const router: IRouter = Router();

const ReportSchema = z.object({
  question: z.string().trim().min(1).max(700),
  answer: z.string().trim().min(1).max(4000),
  reason: z.enum(["incorrect", "confusing", "off_topic"]).default("incorrect"),
});

// POST /api/chat/report — "this answer looks wrong".
// Stores the report and demotes any cached answer for the same question so
// a bad answer is not served to other learners.
router.post("/chat/report", requireAuth, async (req, res) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid report." });
    return;
  }
  const { userId } = req.auth!;
  const { question, answer, reason } = parsed.data;

  try {
    await db.insert(answerReportsTable).values({ clerkUserId: userId, question, answer, reason });
    await db
      .update(knowledgeObjectTable)
      .set({
        qualityScore: sql`GREATEST(0, ${knowledgeObjectTable.qualityScore} - 0.3)`,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeObjectTable.normalizedQuestion, normalizeQuestion(question)));
    res.json({ received: true });
  } catch (err) {
    req.log?.error({ err }, "answer report failed");
    res.status(500).json({ error: "Could not save report." });
  }
});

export default router;
