import test from "node:test";
import assert from "node:assert/strict";
import { cacheSimilarity, normalizeQuestion } from "./knowledge-cache";

test("normalizeQuestion collapses punctuation, case, and curly quotes", () => {
  assert.equal(
    normalizeQuestion("What's  the Capital of France?!"),
    normalizeQuestion("whats the capital of france"),
  );
});

test("cacheSimilarity treats near-identical phrasing as reusable", () => {
  const score = cacheSimilarity(
    "What is the capital of France?",
    "What's the capital of France",
  );
  assert.equal(score, 1);
});

test("cacheSimilarity ignores shared stopwords between unrelated questions", () => {
  // These two share only function words ("what", "is", "the") once
  // normalized — without stopword filtering that overlap would inflate
  // the score even though the questions are about completely different
  // topics.
  const score = cacheSimilarity(
    "What is the capital of France?",
    "What is the boiling point of water?",
  );
  assert.ok(score < 0.3, `expected low similarity for unrelated questions, got ${score}`);
});

test("cacheSimilarity rewards real topical overlap even with different phrasing", () => {
  const score = cacheSimilarity(
    "Can you explain photosynthesis in plants?",
    "How does photosynthesis work in plants?",
  );
  assert.ok(score >= 0.6, `expected high similarity for paraphrased question, got ${score}`);
});
