import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { leaderboardTable, userProgressTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Request schema ───────────────────────────────────────────────────────────

const SyncBodySchema = z.object({
  name: z.string().min(1).max(64),
  // Server-side limits prevent leaderboard spoofing.
  xp: z.number().int().min(0).max(10_000_000),
  level: z.number().int().min(1).max(1000),
  streak: z.number().int().min(0).max(3650),
  totalQuizzes: z.number().int().min(0).max(1_000_000),
});

// ─── POST /api/leaderboard/sync ──────────────────────────────────────────────
//
// Requires authentication. The sync is server-authoritative when a user has
// a progress record: the stats come from user_progress, not the request body,
// preventing clients from spoofing their XP/level/streak.

router.post("/leaderboard/sync", requireAuth, async (req, res) => {
  const { userId } = req.auth!;

  const parsed = SyncBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // Leaderboard is strictly server-authoritative. We only accept the
  // display name from the client; all stats come from user_progress.
  // If the DB is unreachable or the user has no progress record yet,
  // we return an error rather than accepting client-supplied values.
  let serverStats: {
    xp: number; level: number; streak: number; totalQuizzes: number;
  } | null = null;
  try {
    const [progress] = await db
      .select({
        xp: userProgressTable.xp,
        level: userProgressTable.level,
        streak: userProgressTable.streak,
        totalQuizzes: userProgressTable.totalQuizzes,
      })
      .from(userProgressTable)
      .where(eq(userProgressTable.clerkUserId, userId))
      .limit(1);

    serverStats = progress ?? null;
  } catch (err) {
    req.log?.error({ err }, "leaderboard/sync: failed to read user_progress");
    res.status(503).json({ error: "Could not verify server-side progress. Try again shortly." });
    return;
  }

  if (!serverStats) {
    // User has no progress record yet — leaderboard entry cannot be created
    // without a trusted source of truth.
    res.status(422).json({ error: "No progress record found. Complete a quiz to appear on the leaderboard." });
    return;
  }

  const syncData = { name: parsed.data.name, ...serverStats };

  try {
    await db
      .insert(leaderboardTable)
      .values({ clerkUserId: userId, ...syncData })
      .onConflictDoUpdate({
        target: leaderboardTable.clerkUserId,
        set: { ...syncData, updatedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "leaderboard/sync error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/leaderboard ────────────────────────────────────────────────────

router.get("/leaderboard", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: leaderboardTable.id,
        name: leaderboardTable.name,
        xp: leaderboardTable.xp,
        level: leaderboardTable.level,
        streak: leaderboardTable.streak,
        totalQuizzes: leaderboardTable.totalQuizzes,
      })
      .from(leaderboardTable)
      .orderBy(desc(leaderboardTable.xp))
      .limit(50);

    res.json(rows);
  } catch (err) {
    _req.log?.error({ err }, "leaderboard GET error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
