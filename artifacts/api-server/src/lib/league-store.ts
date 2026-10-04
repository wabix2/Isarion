import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  GROUP_SIZE,
  TIER_NAMES,
  creditedDelta,
  demoteCount,
  previousWeekStart,
  promoteCount,
  resolveMovement,
  totalXpFromLevel,
  weekEndsAt,
  weekStartUtc,
  type LeagueResult,
} from "./league";

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> };

interface MemberRow {
  id: number;
  tier: number;
  group_id: number;
  weekly_xp: number;
  last_total_xp: number;
  result: LeagueResult | null;
}

async function rowsOf<T>(tx: Executor, query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await tx.execute(query);
  return res.rows as T[];
}

/**
 * Returns this week's membership row for the user, creating it on first use.
 *
 * When joining a new week, the user's tier is decided from their finished
 * rank in the previous week's group (promote / demote / stay). Inactive
 * gaps of more than a week keep the old tier. New users start in Bronze.
 * `baselineTotal` is the lifetime XP at join time so earlier XP is not
 * credited to the new week.
 */
async function ensureMembership(
  tx: Executor,
  userId: string,
  weekStart: string,
  baselineTotal: number,
): Promise<MemberRow> {
  const select = sql`
    select id, tier, group_id, weekly_xp, last_total_xp, result
    from league_members
    where clerk_user_id = ${userId} and week_start = ${weekStart}`;

  const [existing] = await rowsOf<MemberRow>(tx, select);
  if (existing) return existing;

  let tier = 0;
  let result: LeagueResult | null = null;

  const [prev] = await rowsOf<{ id: number; week_start: string; tier: number; group_id: number; weekly_xp: number }>(
    tx,
    sql`select id, week_start, tier, group_id, weekly_xp
        from league_members
        where clerk_user_id = ${userId} and week_start < ${weekStart}
        order by week_start desc
        limit 1`,
  );

  if (prev) {
    tier = prev.tier;
    result = "stayed";
    if (prev.week_start === previousWeekStart(weekStart)) {
      const [standing] = await rowsOf<{ rank: number; size: number }>(
        tx,
        sql`select
              (1 + count(*) filter (
                 where weekly_xp > ${prev.weekly_xp}
                    or (weekly_xp = ${prev.weekly_xp} and id < ${prev.id})))::int as rank,
              count(*)::int as size
            from league_members
            where week_start = ${prev.week_start}
              and tier = ${prev.tier}
              and group_id = ${prev.group_id}`,
      );
      const moved = resolveMovement(prev.tier, standing.rank, standing.size, prev.weekly_xp);
      tier = moved.tier;
      result = moved.result;
    }
  }

  // Serialize group allocation per (week, tier) so groups don't overfill.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`league:${weekStart}:${tier}`}))`);

  const [open] = await rowsOf<{ group_id: number }>(
    tx,
    sql`select group_id
        from league_members
        where week_start = ${weekStart} and tier = ${tier}
        group by group_id
        having count(*) < ${GROUP_SIZE}
        order by group_id
        limit 1`,
  );
  let groupId = open?.group_id;
  if (groupId === undefined) {
    const [next] = await rowsOf<{ next: number }>(
      tx,
      sql`select (coalesce(max(group_id), 0) + 1)::int as next
          from league_members
          where week_start = ${weekStart} and tier = ${tier}`,
    );
    groupId = next.next;
  }

  await tx.execute(sql`
    insert into league_members (clerk_user_id, week_start, tier, group_id, weekly_xp, last_total_xp, result)
    values (${userId}, ${weekStart}, ${tier}, ${groupId}, 0, ${baselineTotal}, ${result})
    on conflict (clerk_user_id, week_start) do nothing`);

  const [created] = await rowsOf<MemberRow>(tx, select);
  return created;
}

/**
 * Credits XP earned since the last sync to the user's weekly league total.
 * `previousTotal` is the lifetime XP before this sync (null for a brand-new
 * user, who gets no retroactive credit).
 */
export async function recordWeeklyXp(
  userId: string,
  previousTotal: number | null,
  newTotal: number,
  now: Date = new Date(),
): Promise<void> {
  const weekStart = weekStartUtc(now);
  await db.transaction(async (tx) => {
    const member = await ensureMembership(tx as unknown as Executor, userId, weekStart, previousTotal ?? newTotal);
    const delta = creditedDelta(member.last_total_xp, newTotal);
    await tx.execute(sql`
      update league_members
      set weekly_xp = weekly_xp + ${delta},
          last_total_xp = ${newTotal},
          updated_at = now()
      where id = ${member.id}`);
  });
}

export interface LeagueView {
  tier: number;
  tierName: string;
  weekStart: string;
  endsAt: string;
  lastResult: LeagueResult | null;
  rank: number;
  size: number;
  promoteCount: number;
  demoteCount: number;
  members: { rank: number; name: string; weeklyXp: number; isMe: boolean }[];
}

/** The caller's current league group, or null if they have no progress record yet. */
export async function getLeagueView(userId: string, now: Date = new Date()): Promise<LeagueView | null> {
  const weekStart = weekStartUtc(now);
  return db.transaction(async (tx) => {
    const ex = tx as unknown as Executor;
    const [progress] = await rowsOf<{ level: number; xp: number }>(
      ex,
      sql`select level, xp from user_progress where clerk_user_id = ${userId} limit 1`,
    );
    if (!progress) return null;

    const member = await ensureMembership(ex, userId, weekStart, totalXpFromLevel(progress.level, progress.xp));

    const rows = await rowsOf<{ clerk_user_id: string; weekly_xp: number; name: string }>(
      ex,
      sql`select m.clerk_user_id, m.weekly_xp, coalesce(p.name, 'Scholar') as name
          from league_members m
          left join user_progress p on p.clerk_user_id = m.clerk_user_id
          where m.week_start = ${weekStart} and m.tier = ${member.tier} and m.group_id = ${member.group_id}
          order by m.weekly_xp desc, m.id asc`,
    );
    const members = rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      weeklyXp: r.weekly_xp,
      isMe: r.clerk_user_id === userId,
    }));
    return {
      tier: member.tier,
      tierName: TIER_NAMES[member.tier] ?? TIER_NAMES[0],
      weekStart,
      endsAt: weekEndsAt(weekStart),
      lastResult: member.result,
      rank: members.find((m) => m.isMe)?.rank ?? members.length,
      size: members.length,
      promoteCount: promoteCount(members.length),
      demoteCount: demoteCount(members.length),
      members,
    };
  });
}
