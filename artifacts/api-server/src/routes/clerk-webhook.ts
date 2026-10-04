import express, { Router, type IRouter } from "express";
import { eq, or, sql } from "drizzle-orm";
import {
  db,
  userProgressTable,
  leaderboardTable,
  learnerMasteryTable,
  learnerEvidenceTable,
  learnerMisconceptionTable,
  referralCodesTable,
  referralRedemptionsTable,
  answerReportsTable,
  leagueMembersTable,
} from "@workspace/db";
import { verifySvixSignature } from "../lib/svix-verify";

const router: IRouter = Router();

interface ClerkUserData {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: { id: string; email_address: string }[];
  deleted?: boolean;
}

function extractProfile(u: ClerkUserData) {
  const email =
    u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address ??
    u.email_addresses?.[0]?.email_address ??
    "";
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  const name = (full || u.username || "Scholar").slice(0, 64);
  return { email, name };
}

async function deleteUserData(userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(userProgressTable).where(eq(userProgressTable.clerkUserId, userId));
    await tx.delete(leaderboardTable).where(eq(leaderboardTable.clerkUserId, userId));
    await tx.delete(learnerMasteryTable).where(eq(learnerMasteryTable.clerkUserId, userId));
    await tx.delete(learnerEvidenceTable).where(eq(learnerEvidenceTable.clerkUserId, userId));
    await tx
      .delete(learnerMisconceptionTable)
      .where(eq(learnerMisconceptionTable.clerkUserId, userId));
    await tx.delete(referralCodesTable).where(eq(referralCodesTable.ownerClerkUserId, userId));
    await tx
      .delete(referralRedemptionsTable)
      .where(
        or(
          eq(referralRedemptionsTable.referredClerkUserId, userId),
          eq(referralRedemptionsTable.referrerClerkUserId, userId),
        ),
      );
    await tx.delete(leagueMembersTable).where(eq(leagueMembersTable.clerkUserId, userId));
    await tx.delete(answerReportsTable).where(eq(answerReportsTable.clerkUserId, userId));
    await tx.execute(sql`delete from feature_usage where clerk_user_id = ${userId}`);
  });
}

// Raw body is required for signature verification, so this route uses
// express.raw and must be mounted BEFORE express.json (see app.ts).
router.post(
  "/webhooks/clerk",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      res.status(503).json({ error: "Webhook not configured (CLERK_WEBHOOK_SECRET missing)." });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    const valid = verifySvixSignature(
      rawBody,
      {
        id: req.header("svix-id"),
        timestamp: req.header("svix-timestamp"),
        signature: req.header("svix-signature"),
      },
      secret,
    );
    if (!valid) {
      res.status(400).json({ error: "Invalid webhook signature." });
      return;
    }

    let event: { type?: string; data?: ClerkUserData };
    try {
      event = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ error: "Invalid JSON." });
      return;
    }

    const userId = event.data?.id;
    try {
      if (userId && (event.type === "user.created" || event.type === "user.updated")) {
        const { email, name } = extractProfile(event.data!);
        await db
          .insert(userProgressTable)
          .values({ clerkUserId: userId, email, name })
          .onConflictDoUpdate({
            target: userProgressTable.clerkUserId,
            set: { ...(email ? { email } : {}), name, updatedAt: new Date() },
          });
      } else if (userId && event.type === "user.deleted") {
        await deleteUserData(userId);
      }
      // Other event types are acknowledged and ignored.
      res.json({ received: true });
    } catch (err) {
      req.log?.error({ err, type: event.type }, "clerk webhook handling failed");
      // 500 makes Clerk/Svix retry.
      res.status(500).json({ error: "Webhook handling failed." });
    }
  },
);

export default router;
