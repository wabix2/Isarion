export function stripPrivateContent(value: string): string {
  return value
    .replace(/\b(?:my email|my phone)\s*(?:is|:)?\s*[^.!?\n]+/gi, "[redacted personal detail]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[redacted phone]")
    .replace(/\b(?:my name is|i am called|call me)\s+[^.!?\n]+/gi, "[redacted personal detail]")
    .trim();
}

export function isSafeReusableContent(value: string): boolean {
  return (
    value.length > 0 &&
    !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(value) &&
    !/\b(?:my name is|call me|my email|my phone)\b/i.test(value)
  );
}