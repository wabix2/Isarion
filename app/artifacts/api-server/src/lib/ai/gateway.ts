import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../logger";

export type AIMessage = {
  role: "user" | "assistant";
  text: string;
};

export type TutorAnswer = {
  explanation: string;
  examples: string[];
  misconceptions: string[];
  prerequisites: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | "unknown";
};

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, max);
}

/**
 * Gemini is asked to return JSON, but a model response is never guaranteed
 * to be well-formed — a stray code fence, a truncated response, or a model
 * that ignores the instruction can all happen. Tutoring must keep working
 * even then, so on any parse failure the raw text becomes the explanation
 * and the structured extras are simply empty rather than the request
 * failing outright.
 */
export function parseTutorAnswer(raw: string): TutorAnswer {
  const fallback: TutorAnswer = {
    explanation: raw.trim(),
    examples: [],
    misconceptions: [],
    prerequisites: [],
    difficulty: "unknown",
  };
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  if (!cleaned.startsWith("{")) return fallback;

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const explanation =
      typeof parsed.explanation === "string" && parsed.explanation.trim()
        ? parsed.explanation.trim()
        : fallback.explanation;
    const difficulty =
      typeof parsed.difficulty === "string" &&
      ["beginner", "intermediate", "advanced"].includes(parsed.difficulty)
        ? (parsed.difficulty as TutorAnswer["difficulty"])
        : "unknown";
    return {
      explanation,
      examples: asStringArray(parsed.examples, 2),
      misconceptions: asStringArray(parsed.misconceptions, 2),
      prerequisites: asStringArray(parsed.prerequisites, 3),
      difficulty,
    };
  } catch {
    return fallback;
  }
}

export class AIGatewayError extends Error {
  constructor(
    message: string,
    public readonly feature: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AIGatewayError";
  }
}

type CompletionOptions = {
  feature: string;
  systemInstruction: string;
  prompt: string;
  history?: AIMessage[];
  maxOutputTokens?: number;
  responseMimeType?: "application/json";
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The only module allowed to construct a Gemini client.
 *
 * Every call has the same timeout, retry, error, and usage logging behavior.
 * The gateway deliberately does not route between models or cache results;
 * those concerns belong to later layers.
 */
export class AIGateway {
  private readonly client: GoogleGenerativeAI;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new AIGatewayError("Gemini API key not configured.", "gateway");
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  private async complete(options: CompletionOptions): Promise<string> {
    let lastError: unknown;
    const startedAt = Date.now();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const attemptStartedAt = Date.now();
      try {
        const model = this.client.getGenerativeModel({
          model: DEFAULT_MODEL,
          generationConfig: {
            maxOutputTokens: options.maxOutputTokens ?? 700,
            ...(options.responseMimeType
              ? { responseMimeType: options.responseMimeType }
              : {}),
          },
        });
        const history = (options.history ?? []).map((message) => ({
          role: message.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: [{ text: message.text }],
        }));
        const chat = model.startChat({
          history,
          systemInstruction: options.systemInstruction,
        });

        // An AbortController is wired into the SDK call itself so a timeout
        // actually cancels the in-flight Gemini request, instead of just
        // abandoning our promise while Gemini keeps generating — and
        // billing — in the background. Promise.race against a timer (what
        // this used to do) only stops *us* from waiting; it doesn't stop
        // the request.
        const abortController = new AbortController();
        const timer = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);
        let result: Awaited<ReturnType<typeof chat.sendMessage>>;
        try {
          result = await chat.sendMessage(options.prompt, { signal: abortController.signal });
        } catch (sendError) {
          if (abortController.signal.aborted) {
            throw new AIGatewayError("Gemini request timed out.", options.feature, true);
          }
          throw sendError;
        } finally {
          clearTimeout(timer);
        }
        const text = result.response.text().trim();
        if (!text) {
          throw new AIGatewayError("Gemini returned an empty response.", options.feature, true);
        }

        logger.info(
          {
            feature: options.feature,
            attempt,
            latencyMs: Date.now() - attemptStartedAt,
            totalLatencyMs: Date.now() - startedAt,
          },
          "AI gateway call completed",
        );
        return text;
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof AIGatewayError
            ? error.retryable
            : /timeout|timed out|429|500|502|503|504|rate/i.test(String(error));
        if (!retryable || attempt === MAX_ATTEMPTS) break;
        await sleep(250 * 2 ** (attempt - 1));
      }
    }

    logger.error(
      {
        feature: options.feature,
        attempts: MAX_ATTEMPTS,
        latencyMs: Date.now() - startedAt,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      },
      "AI gateway call failed",
    );
    if (lastError instanceof AIGatewayError) throw lastError;
    throw new AIGatewayError(
      lastError instanceof Error ? lastError.message : "Gemini request failed.",
      options.feature,
      false,
    );
  }

  async askTutor(prompt: string, history: AIMessage[] = [], topic?: string): Promise<TutorAnswer> {
    const raw = await this.complete({
      feature: "askTutor",
      prompt,
      history,
      systemInstruction: `You are a focused study assistant${topic ? ` helping a student with ${topic}` : ""}.
Respond with ONLY valid JSON, no markdown fences and no text outside the JSON object, matching exactly this shape:
{"explanation": string, "examples": string[], "misconceptions": string[], "prerequisites": string[], "difficulty": "beginner" | "intermediate" | "advanced"}
Rules:
- "explanation": clear, self-contained answer, under 200 words.
- "examples": 0-2 short concrete examples that aid understanding. Omit ones that don't add value — do not pad the array.
- "misconceptions": 0-2 common misunderstandings a student might have about this specific question, only if genuinely relevant.
- "prerequisites": 0-3 short concept names a student should already know to follow the explanation.
- "difficulty": your best estimate of this question's difficulty.
These fields are reused verbatim for other students asking similar questions, so write "explanation" generally rather than referencing anything specific to this conversation (no "as you said", no names).`,
    });
    return parseTutorAnswer(raw);
  }

  evaluateFeynman(explanation: string, topic: string, history: AIMessage[] = []): Promise<string> {
    return this.complete({
      feature: "evaluateFeynman",
      prompt: explanation,
      history,
      maxOutputTokens: 300,
      systemInstruction: `You are a Feynman Technique mentor. The student is explaining ${topic}.
Identify the most important gap or incorrect claim, then ask exactly one sharp follow-up question.
Do not explain the concept yourself. Be encouraging and precise. Keep the response under 80 words.`,
    });
  }

  evaluateFeynmanStructured(input: {
    explanation: string;
    topic: string;
    history?: AIMessage[];
    sourceExcerpt?: string;
  }): Promise<string> {
    const { explanation, topic, history = [], sourceExcerpt } = input;
    return this.complete({
      feature: "evaluateFeynmanStructured",
      prompt: explanation,
      history,
      maxOutputTokens: 400,
      responseMimeType: "application/json",
      systemInstruction: `You are a Feynman Technique mentor. The student is explaining "${topic}" in their own words${sourceExcerpt ? ", drawing on material they uploaded" : ""}.
${sourceExcerpt ? `Reference material — use it only to check accuracy and completeness:\n"""\n${sourceExcerpt.slice(0, 6000)}\n"""\n` : ""}
Identify the single weakest or least accurate part, give one concrete next step, write an encouraging reply under 60 words with exactly one sharp follow-up question, and score completeness and accuracy from 0 to 1.
Return ONLY valid JSON matching exactly:
{"reply":"...","weakestPart":"...","suggestion":"...","score":0.0}`,
    });
  }

  explainConcept(prompt: string, topic?: string): Promise<string> {
    return this.complete({
      feature: "explainConcept",
      prompt,
      systemInstruction: `Explain the concept accurately for a student.
Use one concrete example and avoid unnecessary jargon.${topic ? ` Focus on ${topic}.` : ""}`,
    });
  }

  analyzeMistake(prompt: string, topic?: string): Promise<string> {
    return this.complete({
      feature: "analyzeMistake",
      prompt,
      systemInstruction: `Analyze the learner's mistake. State the misconception, why it is wrong,
and one corrective practice step. Do not invent facts.${topic ? ` The concept is ${topic}.` : ""}`,
    });
  }

  generateQuiz(prompt: string, topic?: string): Promise<string>;
  generateQuiz(context: {
    subject: string;
    stageTitle?: string;
    masteryLabel?: string;
    weakAreas?: string[];
    misconceptions?: string[];
    count: number;
  }): Promise<string>;
  generateQuiz(
    promptOrContext: string | {
      subject: string;
      stageTitle?: string;
      masteryLabel?: string;
      weakAreas?: string[];
      misconceptions?: string[];
      count: number;
    },
    topic?: string,
  ): Promise<string> {
    if (typeof promptOrContext !== "string") {
      const context = promptOrContext;
      const focusLines = [
        context.stageTitle ? `Learning stage: ${context.stageTitle}.` : null,
        context.masteryLabel ? `Current mastery: ${context.masteryLabel}.` : null,
        context.weakAreas?.length ? `Weak areas: ${context.weakAreas.join(", ")}.` : null,
        context.misconceptions?.length
          ? `Misconceptions to target: ${context.misconceptions.join(", ")}.`
          : null,
      ].filter(Boolean).join(" ");
      return this.complete({
        feature: "generateQuiz",
        prompt: `Generate exactly ${context.count} original multiple-choice questions for "${context.subject}".
${focusLines || "Cover a varied spread of foundational topics."}
Every question must have exactly one correct answer among four options.`,
        systemInstruction: `Return ONLY valid JSON matching exactly:
{"questions":[{"q":"question text","options":["a","b","c","d"],"answer":0}]}
"answer" is the zero-based correct option index. Keep questions under 200 characters and options under 80 characters. Do not invent facts.`,
        maxOutputTokens: 1400,
        responseMimeType: "application/json",
      });
    }
    return this.complete({
      feature: "generateQuiz",
      prompt: promptOrContext,
      systemInstruction: `Generate a quiz as valid JSON with a questions array.
Each question must have q, options (four strings), and answer (zero-based integer).
Do not include markdown fences.${topic ? ` The topic is ${topic}.` : ""}`,
      maxOutputTokens: 1200,
    });
  }

  generateFlashcards(prompt: string, topic?: string): Promise<string> {
    return this.complete({
      feature: "generateFlashcards",
      prompt,
      systemInstruction: `Generate flashcards as valid JSON with a cards array.
Each card must have front and back strings. Do not include markdown fences.
${topic ? `The topic is ${topic}.` : ""}`,
      maxOutputTokens: 1000,
    });
  }

  generateStudyPlan(prompt: string): Promise<string> {
    return this.complete({
      feature: "generateStudyPlan",
      prompt,
      systemInstruction: "Generate a practical study plan as valid JSON with a title and steps array. Do not include markdown fences.",
      maxOutputTokens: 900,
    });
  }
}

export function createAIGateway(): AIGateway {
  return new AIGateway();
}