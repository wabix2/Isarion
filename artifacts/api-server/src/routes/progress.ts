import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  referralCodesTable,
  referralRedemptionsTable,
  userProgressTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { recordWeeklyXp } from "../lib/league-store";
import { totalXpFromLevel } from "../lib/league";

const router: IRouter = Router();

// ─── Request schema ───────────────────────────────────────────────────────────

const SyncBodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(64).default("Scholar"),
  xp: z.number().int().min(0).max(10_000_000).default(0),
  level: z.number().int().min(1).max(1000).default(1),
  streak: z.number().int().min(0).max(3650).default(0),
  streakFreezes: z.number().int().min(0).max(100).default(1),
  totalQuizzes: z.number().int().min(0).max(1_000_000).default(0),
  totalFeynmanSessions: z.number().int().min(0).max(1_000_000).default(0),
  feynmanSessionsToday: z.number().int().min(0).max(1000).default(0),
  lastActiveDate: z.string().max(20).default(""),
  subjects: z.array(z.string().max(100)).max(100).default([]),
  dailyGoalMinutes: z.number().int().min(1).max(480).default(10),
  skillProgress: z.record(z.string().max(100), z.number().min(0).max(100)).default({}),
  isOnboarded: z.boolean().default(false),
  referralCode: z.string().regex(/^LUMI-[A-Z0-9]{7}$/).optional(),
});

const ReferralCodeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^LUMI-[A-Z0-9]{7}$/),
});

// ─── Referral registration and redemption ────────────────────────────────────

router.post("/referrals/register", requireAuth, async (req, res) => {
  const parsed = ReferralCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid referral code." });
    return;
  }

  const { userId } = req.auth!;
  const { code } = parsed.data;

  try {
    const [owned] = await db
      .select({ code: referralCodesTable.code })
      .from(referralCodesTable)
      .where(eq(referralCodesTable.ownerClerkUserId, userId))
      .limit(1);
    if (owned) {
      res.json({ ok: true, code: owned.code });
      return;
    }

    const [conflict] = await db
      .select({ ownerClerkUserId: referralCodesTable.ownerClerkUserId })
      .from(referralCodesTable)
      .where(eq(referralCodesTable.code, code))
      .limit(1);
    if (conflict && conflict.ownerClerkUserId !== userId) {
      res.status(409).json({ error: "That referral code is already in use." });
      return;
    }

    await db
      .insert(referralCodesTable)
      .values({ code, ownerClerkUserId: userId })
      .onConflictDoNothing();
    res.json({ ok: true, code });
  } catch (err) {
    req.log?.error({ err }, "referrals/register error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/referrals/me", requireAuth, async (req, res) => {
  try {
    const [row] = await db
      .select({
        referralCount: referralCodesTable.referralCount,
        rewardGranted: referralCodesTable.rewardGranted,
      })
      .from(referralCodesTable)
      .where(eq(referralCodesTable.ownerClerkUserId, req.auth!.userId))
      .limit(1);
    res.json({
      referralsCompleted: row?.referralCount ?? 0,
      rewardGranted: row?.rewardGranted ?? false,
    });
  } catch (err) {
    req.log?.error({ err }, "referrals/me error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/referrals/redeem", requireAuth, async (req, res) => {
  const parsed = ReferralCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid referral code." });
    return;
  }

  const referredClerkUserId = req.auth!.userId;
  try {
    const [referrer] = await db
      .select()
      .from(referralCodesTable)
      .where(eq(referralCodesTable.code, parsed.data.code))
      .limit(1);

    if (!referrer) {
      res.status(404).json({ error: "Referral code not found." });
      return;
    }
    if (referrer.ownerClerkUserId === referredClerkUserId) {
      res.status(400).json({ error: "You cannot redeem your own referral code." });
      return;
    }

    const [existing] = await db
      .select({ id: referralRedemptionsTable.id })
      .from(referralRedemptionsTable)
      .where(eq(referralRedemptionsTable.referredClerkUserId, referredClerkUserId))
      .limit(1);
    if (existing) {
      res.json({
        ok: true,
        referralsCompleted: referrer.referralCount,
        rewardGranted: referrer.rewardGranted,
        alreadyRedeemed: true,
      });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(referralRedemptionsTable)
        .values({
          referralCode: parsed.data.code,
          referrerClerkUserId: referrer.ownerClerkUserId,
          referredClerkUserId,
        })
        .onConflictDoNothing()
        .returning({ id: referralRedemptionsTable.id });

      if (!inserted) {
        return {
          referralCount: referrer.referralCount,
          rewardGranted: referrer.rewardGranted,
        };
      }

      const grantReward = !referrer.rewardGranted && referrer.referralCount + 1 >= 3;
      const [updated] = await tx
        .update(referralCodesTable)
        .set({
          referralCount: sql`${referralCodesTable.referralCount} + 1`,
          rewardGranted: grantReward ? true : referrer.rewardGranted,
        })
        .where(eq(referralCodesTable.ownerClerkUserId, referrer.ownerClerkUserId))
        .returning({
          referralCount: referralCodesTable.referralCount,
          rewardGranted: referralCodesTable.rewardGranted,
        });

      // Keep the backup record in sync when the referrer has linked one.
      if (grantReward) {
        await tx
          .update(userProgressTable)
          .set({
            referralCount: updated.referralCount,
            referralRewardGranted: true,
            streakFreezes: sql`${userProgressTable.streakFreezes} + 1`,
          })
          .where(eq(userProgressTable.clerkUserId, referrer.ownerClerkUserId));
      } else {
        await tx
          .update(userProgressTable)
          .set({ referralCount: updated.referralCount })
          .where(eq(userProgressTable.clerkUserId, referrer.ownerClerkUserId));
      }
      return updated;
    });

    res.json({
      ok: true,
      referralsCompleted: result.referralCount,
      rewardGranted: result.rewardGranted,
    });
  } catch (err) {
    req.log?.error({ err }, "referrals/redeem error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/progress/me ────────────────────────────────────────────────────

router.get("/progress/me", requireAuth, async (req, res) => {
  const { userId } = req.auth!;

  try {
    const [row] = await db
      .select()
      .from(userProgressTable)
      .where(eq(userProgressTable.clerkUserId, userId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "No progress record found for this user." });
      return;
    }

    res.json({
      name: row.name,
      xp: row.xp,
      level: row.level,
      streak: row.streak,
      streakFreezes: row.streakFreezes,
      totalQuizzes: row.totalQuizzes,
      totalFeynmanSessions: row.totalFeynmanSessions,
      feynmanSessionsToday: row.feynmanSessionsToday,
      lastActiveDate: row.lastActiveDate,
      subjects: row.subjects,
      dailyGoalMinutes: row.dailyGoalMinutes,
      skillProgress: row.skillProgress,
      isOnboarded: row.isOnboarded,
      referralCode: row.referralCode,
      referralCount: row.referralCount,
      referralRewardGranted: row.referralRewardGranted,
    });
  } catch (err) {
    req.log?.error({ err }, "progress/me error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/progress/sync ─────────────────────────────────────────────────

router.post("/progress/sync", requireAuth, async (req, res) => {
  const { userId } = req.auth!;

  const parsed = SyncBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;

  try {
    const [before] = await db
      .select({ xp: userProgressTable.xp, level: userProgressTable.level })
      .from(userProgressTable)
      .where(eq(userProgressTable.clerkUserId, userId))
      .limit(1);

    await db
      .insert(userProgressTable)
      .values({ clerkUserId: userId, ...data })
      .onConflictDoUpdate({
        target: userProgressTable.clerkUserId,
        set: { ...data, updatedAt: new Date() },
      });

    // Weekly league credit. Never let a league problem fail the progress sync.
    try {
      await recordWeeklyXp(
        userId,
        before ? totalXpFromLevel(before.level, before.xp) : null,
        totalXpFromLevel(data.level, data.xp),
      );
    } catch (leagueErr) {
      req.log?.error({ err: leagueErr }, "weekly league update failed");
    }

    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "progress/sync error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
