export type RecommendationMode = "quiz" | "flashcard" | "chat";

export interface HomeRecommendation {
  title: string;
  reason: string;
  action: string;
  skillId?: string;
  mode?: RecommendationMode;
  estimatedMinutes?: number;
}

interface RemoteResponse {
  recommendation?: HomeRecommendation | null;
}

interface LocalFallbackInput {
  subjects: string[];
  skillProgress: Record<string, number>;
}

const REQUEST_TIMEOUT_MS = 3500;

export function getLocalRecommendation({
  subjects,
  skillProgress,
}: LocalFallbackInput): HomeRecommendation {
  const subject = subjects[0] ?? "your next subject";
  const weakest = Object.entries(skillProgress)
    .sort(([, left], [, right]) => left - right)[0];

  if (weakest && weakest[1] < 0.8) {
    return {
      title: `Strengthen ${weakest[0]}`,
      reason: "This is your least-practiced skill, so a short review will have the biggest payoff.",
      action: "Start a review",
      skillId: weakest[0],
      mode: weakest[1] < 0.6 ? "quiz" : "flashcard",
      estimatedMinutes: weakest[1] < 0.6 ? 8 : 5,
    };
  }

  return {
    title: `Continue ${subject}`,
    reason: "Keep your learning streak moving with a focused practice session.",
    action: "Start studying",
    mode: "quiz",
    estimatedMinutes: 8,
  };
}

export async function getHomeRecommendation({
  baseUrl,
  token,
  subject,
  fallback,
}: {
  baseUrl: string;
  token: string | null;
  subject?: string;
  fallback: LocalFallbackInput;
}): Promise<HomeRecommendation> {
  const local = getLocalRecommendation(fallback);
  if (!baseUrl || !token) return local;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    const response = await fetch(`${baseUrl}/api/next-best-action${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) return local;
    const data = (await response.json()) as RemoteResponse;
    return data.recommendation ?? local;
  } catch {
    return local;
  } finally {
    clearTimeout(timeout);
  }
}