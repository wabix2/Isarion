export interface GeneratedQuestion {
  q: string;
  options: string[];
  answer: number;
}

const REQUEST_TIMEOUT_MS = 6000;

/**
 * Requests a fresh, weak-area-targeted quiz from the server. Returns `null`
 * on ANY failure — missing config, no token, offline, timeout, quota hit,
 * or a malformed model response — and never throws. Callers should always
 * have their own static fallback ready; this is a best-effort upgrade over
 * that fallback, not a replacement for it.
 */
export async function generateAIQuiz({
  baseUrl,
  token,
  subject,
  skillId,
  count = 8,
}: {
  baseUrl: string;
  token: string | null;
  subject: string;
  skillId?: string;
  count?: number;
}): Promise<GeneratedQuestion[] | null> {
  if (!baseUrl || !token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/quiz/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subject, skillId, count }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { questions?: GeneratedQuestion[] };
    if (!Array.isArray(data.questions) || data.questions.length === 0) return null;
    // Defensive re-check even though the server validates this shape too —
    // a quiz screen crashing on a malformed option array would be worse
    // than just falling back to the static bank.
    const valid = data.questions.every(
      (item) =>
        typeof item.q === "string" &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        item.options.every((opt) => typeof opt === "string") &&
        Number.isInteger(item.answer) &&
        item.answer >= 0 &&
        item.answer <= 3,
    );
    return valid ? data.questions : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
