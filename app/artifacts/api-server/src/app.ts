import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import clerkWebhookRouter from "./routes/clerk-webhook";
import { logger } from "./lib/logger";
import { buildCorsOptions } from "./lib/cors-config";
import { generalLimiter } from "./lib/rate-limit";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers. API-only server, so we can drop the CSP directives
// meant for browser-rendered HTML responses.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors(buildCorsOptions()));

// CORS errors (origin not on the allowlist) surface as a thrown error from
// the cors() origin callback — normalize that into a clean 403 instead of
// leaking a stack trace / falling through to the generic 500 handler.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Error && err.message.includes("not allowed by CORS policy")) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }
  next(err);
});

// Clerk webhook needs the raw body for signature verification, so it is
// mounted before the JSON parser.
app.use("/api", clerkWebhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", generalLimiter, router);

// Final error handler — anything that reaches here is unexpected; log it
// with the request-scoped logger and never leak internals to the client.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error." });
});

export default app;
