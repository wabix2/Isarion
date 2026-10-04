import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import app from "../app";
import { EvidenceSchema, buildRecommendation, isPro, masteryLabel, updateMastery } from "./learner-model";

test("rejects malformed learner evidence", () => {
  const parsed = EvidenceSchema.safeParse({
    evidenceType: "quiz",
    skillId: "",
    score: 2,
  });
  assert.equal(parsed.success, false);
});

test("accepts quiz, flashcard, and Feynman evidence shapes", () => {
  for (const evidenceType of ["quiz", "flashcard", "feynman"] as const) {
    const parsed = EvidenceSchema.safeParse({
      eventId: `event-${evidenceType}`,
      evidenceType,
      skillId: "Biology:0",
      subject: "Biology",
      score: 0.75,
    });
    assert.equal(parsed.success, true);
  }
});

test("mastery labels are ordered by score", () => {
  assert.equal(masteryLabel(0), "new");
  assert.equal(masteryLabel(0.3), "developing");
  assert.equal(masteryLabel(0.6), "proficient");
  assert.equal(masteryLabel(0.8), "mastered");
});

test("mastery update is deterministic, traceable, and capped", () => {
  const result = updateMastery(undefined, {
    evidenceType: "quiz",
    skillId: "Math:0",
    score: 1,
    weakAreas: [],
    metadata: {},
  });
  assert.equal(result.score, 0.18);
  assert.equal(result.evidenceCount, 1);
  assert.equal(result.correctCount, 1);
  assert.equal(result.incorrectCount, 0);
  assert.deepEqual(result.recentPerformance, [1]);
});

test("Pro access is derived from verified claims only", () => {
  assert.equal(isPro({ public_metadata: { isPro: true } }), true);
  assert.equal(isPro({ metadata: { isPro: "true" } }), true);
  assert.equal(isPro({ isPro: false }), false);
  assert.equal(isPro({}), false);
});

test("recommendation prioritizes a low-mastery skill and keeps Pro detail separate", () => {
  const result = buildRecommendation({
    id: 1,
    clerkUserId: "user-a",
    skillId: "Biology:2",
    subject: "Biology",
    masteryScore: 0.2,
    confidence: 0.3,
    label: "developing",
    weakAreas: ["cell division"],
    misconceptions: ["confuses mitosis and meiosis"],
    correctCount: 0,
    incorrectCount: 2,
    recentPerformance: [0.2],
    topicStrengths: [],
    topicWeaknesses: ["Biology:2"],
    dueReviewAt: new Date(Date.now() - 1000),
    evidenceCount: 2,
    lastUpdated: new Date(),
    updatedAt: new Date(),
  }, true);

  assert.equal(result.recommendation.mode, "quiz");
  assert.equal(result.recommendation.skillId, "Biology:2");
  assert.equal(result.proDetail?.masteryScore, 0.2);
});

test("Free recommendation does not expose Pro detail", () => {
  const result = buildRecommendation({
    id: 1,
    clerkUserId: "user-a",
    skillId: "Math:0",
    subject: "Math",
    masteryScore: 0.9,
    confidence: 1,
    label: "mastered",
    weakAreas: [],
    misconceptions: [],
    correctCount: 9,
    incorrectCount: 1,
    recentPerformance: [0.9],
    topicStrengths: ["Math:0"],
    topicWeaknesses: [],
    dueReviewAt: new Date(Date.now() + 86_400_000),
    evidenceCount: 10,
    lastUpdated: new Date(),
    updatedAt: new Date(),
  }, false);

  assert.equal(result.recommendation.mode, "flashcard");
  assert.equal(result.proDetail, null);
});

test("learner routes reject unauthenticated access", async () => {
  const previousClerkKey = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = previousClerkKey ?? "test-secret";
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const mastery = await fetch(`${baseUrl}/api/mastery`);
    const action = await fetch(`${baseUrl}/api/next-best-action`);
    const evidence = await fetch(`${baseUrl}/api/learning/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ evidenceType: "quiz", skillId: "Biology:0", score: 0.8 }),
    });
    assert.equal(mastery.status, 401);
    assert.equal(action.status, 401);
    assert.equal(evidence.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousClerkKey === undefined) delete process.env.CLERK_SECRET_KEY;
  }
});