import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/auth";
import { chatLimiter } from "../lib/rate-limit";
import { createAIGateway, AIGatewayError } from "../lib/ai/gateway";
import {
  findReusableAnswer,
  normalizeQuestion,
  storeReusableAnswer,
} from "../lib/knowledge-cache";
import { consumeQuota } from "../lib/usage-quota";

const router: IRouter = Router();

const MessageSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(700),
  role: z.enum(["user", "assistant"]),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  mode: z.enum(["ai", "feynman"]).default("ai"),
  topic: z.string().trim().max(160).optional(),
});

function subjectFromTopic(topic?: string): string | undefined {
  if (!topic) return undefined;
  const known = ["Math", "Biology", "Chemistry", "Physics", "History"];
  return known.find((subject) => topic.toLowerCase().includes(subject.toLowerCase()));
}

// The client only renders a single message string, so a structured
// answer (explanation + examples) still needs to collapse into one
// string for the reply — but doing that collapse in one place means a
// fresh Gemini answer and a cache hit render identically to the user,
// and it's the only place that needs updating if the client ever grows
// dedicated UI for examples.
function renderAnswerText(answer: { explanation: string; examples: string[] }): string {
  if (!answer.examples.length) return answer.explanation;
  const exampleLines = answer.examples.map((example) => `• ${example}`).join("\n");
  return `${answer.explanation}\n\nExamples:\n${exampleLines}`;
}

router.post("/chat", requireAuth, chatLimiter, async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { messages, mode, topic } = parsed.data;
  const { userId, claims } = req.auth!;
  const chronological = [...messages].reverse();
  const lastUserIndex = chronological.map((message) => message.role).lastIndexOf("user");
  if (lastUserIndex < 0) {
    res.status(400).json({ error: "No user message found in messages array." });
    return;
  }

  const quota = await consumeQuota(userId, mode === "ai" ? "aiChat" : "feynman", claims);
  if (!quota.allowed) {
    res.status(429).json({
      error: mode === "ai"
        ? "You've used today's free AI chat allowance. Upgrade to Pro for unlimited."
        : "You've used today's free mentor allowance. Upgrade to Pro for unlimited.",
      remaining: quota.remaining,
    });
    return;
  }

  const currentPrompt = chronological[lastUserIndex].text;
  const history = chronological.slice(0, lastUserIndex).map((message) => ({
    role: message.role,
    text: message.text,
  }));
  const subject = subjectFromTopic(topic);

  try {
    if (mode === "ai") {
      try {
        const cached = await findReusableAnswer({
          question: currentPrompt,
          subject,
          topic,
        });
        if (cached) {
          res.json({ text: renderAnswerText(cached), cached: true });
          return;
        }
      } catch (error) {
        // Cache failure must never make tutoring unavailable.
        req.log?.warn({ error }, "knowledge cache lookup failed");
      }
    }

    const gateway = createAIGateway();

    if (mode === "feynman") {
      // Feynman replies are reactions to this specific student's own
      // explanation, not a general answer to a question — never cached,
      // never rendered through the examples formatter.
      const text = await gateway.evaluateFeynman(currentPrompt, topic ?? "the selected concept", history);
      res.json({ text, cached: false });
      return;
    }

    const answer = await gateway.askTutor(currentPrompt, history, topic);

    try {
      await storeReusableAnswer({
        question: currentPrompt,
        conceptId: normalizeQuestion(topic ?? subject ?? currentPrompt).slice(0, 160),
        subject,
        topic,
        answer,
      });
    } catch (error) {
      req.log?.warn({ error }, "knowledge cache write skipped");
    }

    res.json({ text: renderAnswerText(answer), cached: false });
  } catch (error) {
    if (error instanceof AIGatewayError) {
      res.status(503).json({ error: error.message, feature: error.feature });
      return;
    }
    req.log?.error({ error }, "chat route error");
    res.status(500).json({ error: "AI request failed." });
  }
});

export default router;