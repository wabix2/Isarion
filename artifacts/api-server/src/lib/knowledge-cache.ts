import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { knowledgeObjectTable } from "@workspace/db/schema";
import { isSafeReusableContent, stripPrivateContent } from "./knowledge-cache-safety";
import { logger } from "./logger";

const MAX_CACHE_AGE_DAYS = Number(process.env.KNOWLEDGE_CACHE_MAX_AGE_DAYS ?? 30);
const MIN_QUALITY_SCORE = Number(process.env.KNOWLEDGE_CACHE_MIN_QUALITY ?? 0.8);
// Similarity floor for treating a cached answer as reusable. Kept
// configurable because it's the main dial on the cost/precision
// trade-off: lower it and more questions get served from cache (cheaper),
// raise it and reuse only happens for near-identical questions (safer).
const MIN_SIMILARITY = Number(process.env.KNOWLEDGE_CACHE_MIN_SIMILARITY ?? 0.82);
// Scores at or above this (but below MIN_SIMILARITY) get logged as
// near-misses — candidates that were close but not close enough to
// reuse. Watching these in the logs is how MIN_SIMILARITY and the
// stopword list get tuned over time without guessing blind.
const NEAR_MISS_LOG_THRESHOLD = 0.6;

// Common function words carry no topical meaning and, left in, inflate
// the similarity score between otherwise-unrelated questions that just
// happen to share ordinary sentence structure ("what is the", "how does
// the", etc). Stripping them makes the keyword-overlap score track real
// topical overlap much more closely.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "so",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "doing",
  "have", "has", "had", "having",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their",
  "this", "that", "these", "those",
  "what", "when", "where", "which", "who", "whom", "why", "how",
  "of", "in", "on", "at", "by", "for", "with", "about", "against",
  "between", "into", "through", "during", "before", "after", "to", "from",
  "up", "down", "out", "off", "over", "under", "again", "further",
  "not", "no", "nor", "just", "also", "very", "too", "only", "own", "same",
  "please", "explain", "tell", "describe",
]);

export function normalizeQuestion(value: string): string {
  return value
    .toLowerCase()
    // Treat straight and curly apostrophes as word joins so "What's" and
    // "whats" can share a cache key instead of becoming "what s".
    .replace(/['\u2018\u2019]/g, "")
    // Normalize the most common question contraction before stopword
    // filtering, so "what is" and "what's" do not score as different topics.
    .replace(/\bwhats\b/g, "what is")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywords(value: string): Set<string> {
  return new Set(
    normalizeQuestion(value)
      .split(" ")
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

export function cacheSimilarity(question: string, candidate: string): number {
  const left = normalizeQuestion(question);
  const right = normalizeQuestion(candidate);
  if (left === right) return 1;
  const a = keywords(left);
  const b = keywords(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(a.size, b.size);
}

type CachedAnswer = {
  explanation: string;
  examples: string[];
  misconceptions: string[];
  prerequisites: string[];
  difficulty: string;
};

export async function findReusableAnswer({
  question,
  subject,
  topic,
}: {
  question: string;
  subject?: string;
  topic?: string;
}): Promise<typeof knowledgeObjectTable.$inferSelect | null> {
  const normalized = normalizeQuestion(question);
  const filters = [sql`${knowledgeObjectTable.qualityScore} >= ${MIN_QUALITY_SCORE}`];
  if (subject) filters.push(eq(knowledgeObjectTable.subject, subject));
  if (topic) filters.push(eq(knowledgeObjectTable.topic, topic));

  const rows = await db
    .select()
    .from(knowledgeObjectTable)
    .where(and(...filters))
    .orderBy(desc(knowledgeObjectTable.qualityScore), desc(knowledgeObjectTable.usageCount))
    .limit(100);
  const maxAge = Date.now() - MAX_CACHE_AGE_DAYS * 86_400_000;
  const scored = rows
    .filter((row) => row.updatedAt.getTime() >= maxAge)
    .map((row) => ({ row, score: cacheSimilarity(normalized, row.normalizedQuestion) }))
    .sort((a, b) => b.score - a.score);

  const match = scored.find(({ score }) => score >= MIN_SIMILARITY);
  if (!match) {
    // Nothing reusable — see whether we came close. This costs nothing
    // extra (the candidates are already in memory) and is the signal
    // that tells us whether MIN_SIMILARITY is too strict, too loose, or
    // about right for real traffic.
    const bestMiss = scored[0];
    if (bestMiss && bestMiss.score >= NEAR_MISS_LOG_THRESHOLD) {
      logger.debug(
        { question: normalized, bestScore: bestMiss.score, subject, topic },
        "knowledge cache near-miss",
      );
    }
    return null;
  }

  // Reinforce: an answer that keeps matching new questions is proven
  // useful, so nudge its quality score up (capped at 1). Over time this
  // naturally surfaces the most reliably-reused answers ahead of ones
  // that were only ever used once, without any manual curation.
  await db
    .update(knowledgeObjectTable)
    .set({
      usageCount: sql`${knowledgeObjectTable.usageCount} + 1`,
      qualityScore: sql`LEAST(1.0, ${knowledgeObjectTable.qualityScore} + 0.01)`,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeObjectTable.id, match.row.id));
  return match.row;
}

export async function storeReusableAnswer({
  question,
  conceptId,
  subject,
  topic,
  answer,
}: {
  question: string;
  conceptId: string;
  subject?: string;
  topic?: string;
  answer: CachedAnswer;
}): Promise<void> {
  const explanation = stripPrivateContent(answer.explanation);
  const examples = answer.examples.map(stripPrivateContent).filter(isSafeReusableContent);
  const misconceptions = answer.misconceptions.map(stripPrivateContent).filter(isSafeReusableContent);
  const prerequisites = answer.prerequisites.map(stripPrivateContent).filter(isSafeReusableContent);
  if (!isSafeReusableContent(explanation)) return;

  const normalizedQuestion = normalizeQuestion(question);

  // Two users can ask an essentially identical question within the same
  // few hundred milliseconds, before either write has landed — both miss
  // the cache and both call the gateway (unavoidable; the point isn't
  // hit-rate on the very first ask, it's every ask after). Without this
  // check they'd also both insert, leaving a duplicate row that then
  // splits future usageCount/qualityScore reinforcement between two
  // "identical" answers instead of pooling it onto one. A quick exact
  // check on the same normalized question (+subject/topic) before insert
  // folds that second write into the existing row instead.
  const filters = [eq(knowledgeObjectTable.normalizedQuestion, normalizedQuestion)];
  if (subject) filters.push(eq(knowledgeObjectTable.subject, subject));
  if (topic) filters.push(eq(knowledgeObjectTable.topic, topic));
  const [existing] = await db
    .select({ id: knowledgeObjectTable.id })
    .from(knowledgeObjectTable)
    .where(and(...filters))
    .limit(1);
  if (existing) {
    await db
      .update(knowledgeObjectTable)
      .set({ usageCount: sql`${knowledgeObjectTable.usageCount} + 1`, updatedAt: new Date() })
      .where(eq(knowledgeObjectTable.id, existing.id));
    return;
  }

  await db.insert(knowledgeObjectTable).values({
    conceptId: stripPrivateContent(conceptId),
    subject: subject ? stripPrivateContent(subject) : undefined,
    topic: topic ? stripPrivateContent(topic) : undefined,
    normalizedQuestion,
    explanation,
    examples,
    misconceptions,
    prerequisites,
    difficulty: answer.difficulty || "unknown",
    source: "gemini",
    confidence: 0.8,
    qualityScore: 0.8,
    usageCount: 0,
    updatedAt: new Date(),
  });
}