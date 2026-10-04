export type LearnerEvidenceType = "quiz" | "flashcard" | "feynman";
import { API_BASE } from "@/utils/apiConfig";

function eventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function postLearnerEvidence({
  token,
  evidenceType,
  skillId,
  subject,
  score,
  correct,
  total,
  response,
}: {
  token: string | null;
  evidenceType: LearnerEvidenceType;
  skillId: string;
  subject?: string;
  score: number;
  correct?: number;
  total?: number;
  response?: string;
}): Promise<void> {
  if (!API_BASE || !token) return;
  try {
    await fetch(`${API_BASE}/api/learning/evidence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        eventId: eventId(),
        evidenceType,
        skillId,
        subject,
        score: Math.max(0, Math.min(1, score)),
        correct,
        total,
        response,
      }),
    });
  } catch {
    // Learner-model sync must never interrupt the local learning session.
  }
}