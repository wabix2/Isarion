import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod/v4";
// @ts-expect-error — pdf-parse ships no types; add `@types/pdf-parse` or a
// local `declare module "pdf-parse"` if your tsconfig needs one.
import pdfParse from "pdf-parse";
import { requireAuth } from "../middlewares/auth";
import { chatLimiter } from "../lib/rate-limit";
import { consumeQuota } from "../lib/usage-quota";
import { createAIGateway, AIGatewayError } from "../lib/ai/gateway";

const router: IRouter = Router();

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
// Cap on what we ever hand back to the client / feed to Gemini. The client
// trims further (6000 chars) before each evaluate call, but this stops one
// huge file from entering that path at all.
const MAX_EXTRACTED_CHARS = 12_000;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "text/plain", "text/markdown"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Only PDF, .txt, and .md files are supported."));
      return;
    }
    cb(null, true);
  },
});

/**
 * Extracts plain text from an uploaded file so the learner can teach back
 * their own notes/textbook excerpt instead of only the fixed topic list.
 * PDF parsing has no good pure-JS/React-Native story, so this always goes
 * through the server — see utils/fileUpload.ts on the client.
 */
router.post("/feynman/extract-text", requireAuth, upload.single("file"), async (req, res) => {
  const { userId, claims } = req.auth!;
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file was uploaded." });
    return;
  }

  // Extraction costs bandwidth and parsing time even if the learner never
  // sends a message afterward, so it draws from its own daily allowance
  // rather than being free — see feature-limits.ts.
  const quota = await consumeQuota(userId, "docUpload", claims);
  if (!quota.allowed) {
    res.status(429).json({ error: "You've used today's free uploads. Upgrade to Pro for unlimited." });
    return;
  }

  try {
    let text: string;
    if (file.mimetype === "application/pdf") {
      const parsed = await pdfParse(file.buffer);
      text = parsed.text;
    } else {
      text = file.buffer.toString("utf-8");
    }
    text = text.replace(/[ \t]+\n/g, "\n").trim();
    if (!text) {
      res.status(422).json({ error: "Couldn't find any readable text in that file." });
      return;
    }
    const truncated = text.length > MAX_EXTRACTED_CHARS;
    res.json({
      text: truncated ? text.slice(0, MAX_EXTRACTED_CHARS) : text,
      truncated,
    });
  } catch (error) {
    req.log?.warn({ error }, "feynman/extract-text: parse failed");
    res.status(422).json({ error: "Couldn't read that file. Try a different one." });
  }
});

const EvaluateRequestSchema = z.object({
  explanation: z.string().trim().min(1).max(4000),
  topic: z.string().trim().min(1).max(160),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(4000),
      }),
    )
    .max(20)
    .optional(),
  sourceExcerpt: z.string().trim().max(12_000).optional(),
});

const EvaluateResponseSchema = z.object({
  reply: z.string().trim().min(1).max(600),
  weakestPart: z.string().trim().min(1).max(400),
  suggestion: z.string().trim().min(1).max(400),
  score: z.number().min(0).max(1),
});

/**
 * Replaces the generic /chat call for Feynman-mode messages (see
 * chat.tsx's sendMessage). Returns structured {reply, weakestPart,
 * suggestion, score} instead of a paragraph so the client can render the
 * flagged gap as its own callout, and so `score` can drive advanceSkill /
 * learner-evidence instead of a crude message-length heuristic.
 */
router.post("/feynman/evaluate", requireAuth, chatLimiter, async (req, res) => {
  const parsed = EvaluateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { userId, claims } = req.auth!;
  const { explanation, topic, history, sourceExcerpt } = parsed.data;

  // Same enforcement point a mentor session has always used (see
  // feature-limits.ts) — this endpoint now owns that check for Feynman
  // mode instead of routes/chat.ts.
  const quota = await consumeQuota(userId, "feynman", claims);
  if (!quota.allowed) {
    res.status(429).json({ error: "You've used today's free mentor sessions. Upgrade to Pro for unlimited." });
    return;
  }

  try {
    const gateway = createAIGateway();
    const raw = await gateway.evaluateFeynmanStructured({
      explanation,
      topic,
      history,
      sourceExcerpt,
    });

    let evaluation: z.infer<typeof EvaluateResponseSchema>;
    try {
      evaluation = EvaluateResponseSchema.parse(JSON.parse(raw));
    } catch (parseError) {
      req.log?.warn({ parseError, raw: raw.slice(0, 500) }, "feynman/evaluate: model returned unparseable JSON");
      throw new AIGatewayError("Model did not return a valid evaluation.", "evaluateFeynmanStructured", true);
    }

    res.json(evaluation);
  } catch (error) {
    if (error instanceof AIGatewayError) {
      res.status(503).json({ error: error.message, feature: error.feature });
      return;
    }
    req.log?.error({ error }, "feynman/evaluate route error");
    res.status(500).json({ error: "Evaluation failed." });
  }
});

export default router;
