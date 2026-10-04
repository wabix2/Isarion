import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";

// Extend Express Request so routes can read auth without re-parsing.
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; claims: Record<string, unknown> };
    }
  }
}

/**
 * requireAuth — middleware that verifies a Clerk Bearer JWT.
 *
 * Requires CLERK_SECRET_KEY in env. Attaches `req.auth.userId` on success.
 * Returns 401 on missing / invalid / expired tokens.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.status(503).json({ error: "Auth not configured (CLERK_SECRET_KEY missing)." });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header." });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey });
    if (!payload.sub) {
      res.status(401).json({ error: "Token missing subject claim." });
      return;
    }
    req.auth = {
      userId: payload.sub,
      claims: payload as unknown as Record<string, unknown>,
    };
    next();
  } catch (err) {
    req.log?.warn({ err }, "Clerk token verification failed");
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
