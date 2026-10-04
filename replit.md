# Lumiq AI

Lumiq AI is a mobile-first study companion that turns short daily sessions into
adaptive practice with AI tutoring, Feynman explanations, quizzes, flashcards,
progress tracking, referrals, and a global leaderboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server test` — run API tests (uses a local placeholder URL unless `DATABASE_URL` is set)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required production env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `GEMINI_API_KEY`, and
  `ALLOWED_ORIGINS`.
- Optional production env: `GEMINI_MODEL`, `KNOWLEDGE_CACHE_MAX_AGE_DAYS`,
  `KNOWLEDGE_CACHE_MIN_QUALITY`, `KNOWLEDGE_CACHE_MIN_SIMILARITY`,
  `GITHUB_RELEASE_URL`, and the RevenueCat Android public key.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/isarion` — Expo Router Android-first mobile app and its static/landing server
- `artifacts/api-server` — authenticated Express API
- `lib/db/src/schema` — Drizzle source-of-truth for PostgreSQL tables
- `lib/api-spec/openapi.yaml` — API contract
- `artifacts/isarion/constants` — app theme and color tokens
- `artifacts/api-server/src/lib/knowledge-cache.ts` — safe reusable tutor-answer cache

## Architecture decisions

- The mobile artifact is Android-first in the production Expo build; RevenueCat
  purchase initialization is guarded to Android so web/preview runs remain safe.
- The API keeps Gemini behind one gateway with consistent timeout, retry, and
  error handling.
- Tutor answers are parsed into structured fields, then rendered as the existing
  single chat string so the client response contract stays compatible.
- Reusable knowledge is cached only after private-content scrubbing and is
  matched with normalized topical keywords rather than raw sentence overlap.
- Authenticated learner progress and referral writes are persisted in PostgreSQL
  through Drizzle.

## Product

Learners can sign in, choose subjects, receive a next-best study action, chat
with a focused tutor, practice with quizzes and flashcards, explain concepts
using the Feynman technique, track mastery and streaks, invite friends, and
share achievements.

## User preferences

No project-specific preferences recorded.

## Gotchas

- API production startup requires `PORT` and `DATABASE_URL`.
- Production CORS requires an explicit comma-separated `ALLOWED_ORIGINS`; the
  permissive fallback is development-only.
- The Expo static build generates an Android manifest and bundle from Metro and
  can take more than five minutes on a single-core worker.

## Pointers

- See `pnpm-workspace.yaml` for workspace structure, dependency catalogs, and
  package safety settings.
