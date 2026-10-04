# Deploying the API to Render + Clerk webhook

1. Push this project to a GitHub repo.
2. Render dashboard -> New -> Blueprint -> pick the repo (it reads `render.yaml`).
3. Database: create a Postgres (Render -> New -> PostgreSQL, or use any external one).
   Paste its *External/Internal connection string* into `DATABASE_URL`.
4. Tables are created automatically on startup (set RUN_MIGRATIONS=false to disable). Manual option:
   ```
   for f in lib/db/migrations/000*.sql; do psql "$DATABASE_URL" -f "$f"; done
   ```
5. Fill the env vars on the service:
   - `CLERK_SECRET_KEY`     Clerk -> API keys -> Secret key
   - `GEMINI_API_KEY`      Google AI Studio key
   - `ALLOWED_ORIGINS`     comma-separated web origins (native Android needs none, but it must be non-empty)
   - `CLERK_WEBHOOK_SECRET` set in step 7
6. Deploy. Check `https://<service>.onrender.com/api/healthz` and `/api/readyz` return ok.
7. Clerk dashboard -> Webhooks -> Add Endpoint
   - URL: `https://<service>.onrender.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy the Signing Secret (`whsec_...`) into Render as `CLERK_WEBHOOK_SECRET`, redeploy.
   - Use "Send test event" -> expect HTTP 200.
8. Build the mobile app with `EXPO_PUBLIC_API_URL=https://<service>.onrender.com`.

Note: Render's free web plan sleeps after 15 min idle; use Starter for dependable webhooks.
