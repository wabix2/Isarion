import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

/**
 * generalLimiter — applied to all /api routes. Generous, mainly to blunt
 * scraping/credential-stuffing style abuse rather than normal usage.
 */
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

/**
 * chatLimiter — tighter limit for the AI-backed /chat endpoint, since each
 * request costs real money (Gemini calls) and is the most attractive target
 * for abuse. Keyed per authenticated user when available, falling back to IP
 * for unauthenticated/misconfigured cases.
 */
export const chatLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId ?? req.ip ?? "unknown",
  message: { error: "You're sending messages too quickly. Please slow down." },
});
