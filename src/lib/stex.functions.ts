/**
 * STEX server functions — called from client pages.
 * All require auth. OTP polling also runs ingestion → credits user balance.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(1) });
const allocSchema = z.object({
  token: z.string().min(1),
  rid: z.string().min(2).max(64),
  sid: z.string().trim().max(80).optional().nullable(),
  national: z.boolean().optional(),
  no_plus: z.boolean().optional(),
});

// ---------- Live access (services + ranges from upstream) ----------
export const liveAccessFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    await requireAuth(data.token);
    const { stexLiveAccess } = await import("./stex.server");
    const r = await stexLiveAccess();
    if (r.meta.code !== 200 || !r.data) {
      return { services: [] as { sid: string; last_at: number; ranges: string[] }[] };
    }
    // Sort: most recent first
    const services = [...r.data.services].sort((a, b) => b.last_at - a.last_at);
    return { services };
  });

// ---------- Global console feed ----------
export const consoleFeedFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    await requireAuth(data.token);
    const { stexConsole } = await import("./stex.server");
    const r = await stexConsole();
    if (r.meta.code !== 200 || !r.data) return { hits: [] as { range: string; sid: string; message: string; time: number }[] };
    return { hits: r.data.hits };
  });

// ---------- Allocate number ----------
export const allocateNumberFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => allocSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const { sql } = await import("./db.server");
    const { stexGetNum } = await import("./stex.server");

    const r = await stexGetNum(data.rid);
    if (r.meta.code === 2946 || !r.data) {
      throw new Error("Out of stock for this range. Try another.");
    }
    if (r.meta.code !== 200 || !r.data) {
      throw new Error(r.message || "Upstream allocation failed.");
    }
    const n = r.data;
    const flags = { national: !!data.national, no_plus: !!data.no_plus };
    // If user asked for national/no_plus, prefer that representation in the response
    const display =
      data.no_plus ? n.no_plus_number :
      data.national ? n.national_number :
      n.full_number;
    const [row] = await sql`
      INSERT INTO allocations (user_id, rid, sid, full_number, national_number, no_plus_number, country, operator, status, stex_response, flags)
      VALUES (${auth.sub}, ${data.rid}, ${data.sid ?? null}, ${n.full_number}, ${n.national_number}, ${n.no_plus_number}, ${n.country}, ${n.operator}, 'pending', ${JSON.stringify(r)}::jsonb, ${JSON.stringify(flags)}::jsonb)
      RETURNING id, full_number, national_number, no_plus_number, country, operator, created_at
    `;
    const { ensurePollerStarted } = await import("./poller.server");
    ensurePollerStarted();
    return {
      id: row.id,
      full_number: row.full_number,
      national_number: row.national_number,
      no_plus_number: row.no_plus_number,
      display_number: display,
      country: row.country,
      operator: row.operator,
      created_at: row.created_at.toISOString(),
    };
  });

// ---------- Poll & ingest OTPs (called from /inbox refetch) ----------
// Fetches upstream /success-otp, matches against active allocations across all
// users (single admin key serves the whole panel), inserts new OTPs, credits
// matched users with STEX_DEFAULT_PAYOUT. Idempotent via stex_otp_id UNIQUE.
export const ingestOtpsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    await requireAuth(data.token);
    const { forcePollerIngest } = await import("./poller.server");
    await forcePollerIngest("manual-ingest");
    return { ok: true };
  });

// ---------- Summary for the user ----------
export const summaryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const { sql } = await import("./db.server");

    const [stats] = await sql<any[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='success')::int AS success,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status='failed' OR status='expired')::int AS failed,
        COALESCE(SUM(payout_amount) FILTER (WHERE status='success'), 0)::text AS earned,
        COUNT(*) FILTER (WHERE created_at::date = current_date)::int AS today_total,
        COUNT(*) FILTER (WHERE status='success' AND created_at::date = current_date)::int AS today_success,
        COALESCE(SUM(payout_amount) FILTER (WHERE status='success' AND created_at::date = current_date), 0)::text AS today_earned
      FROM allocations WHERE user_id = ${auth.sub}
    `;
    const byCountry = await sql<any[]>`
      SELECT country, COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status='success')::int AS success
      FROM allocations WHERE user_id = ${auth.sub}
      GROUP BY country ORDER BY total DESC LIMIT 10
    `;
    return { stats, byCountry };
  });

// ---------- Dashboard stats (hourly traffic + trending services) ----------
export const dashboardStatsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const { sql } = await import("./db.server");

    // Hourly buckets — last 24h, user-scoped
    const hourly = await sql<any[]>`
      SELECT date_trunc('hour', created_at) AS bucket,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status='success')::int AS success
      FROM allocations
      WHERE user_id = ${auth.sub}
        AND created_at >= now() - interval '24 hours'
      GROUP BY bucket ORDER BY bucket ASC
    `;

    // Today/yesterday totals
    const [today] = await sql<any[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status='success')::int AS success,
             COALESCE(SUM(payout_amount) FILTER (WHERE status='success'),0)::text AS earned
      FROM allocations
      WHERE user_id = ${auth.sub} AND created_at::date = current_date
    `;
    const [yest] = await sql<any[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status='success')::int AS success,
             COALESCE(SUM(payout_amount) FILTER (WHERE status='success'),0)::text AS earned
      FROM allocations
      WHERE user_id = ${auth.sub} AND created_at::date = current_date - 1
    `;
    const [active] = await sql<any[]>`
      SELECT COUNT(*)::int AS n FROM allocations
      WHERE user_id = ${auth.sub} AND status = 'pending'
    `;

    // Trending services — global (last 24h, top 8 by success)
    const trending = await sql<any[]>`
      SELECT COALESCE(sid,'UNKNOWN') AS sid,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status='success')::int AS success
      FROM allocations
      WHERE created_at >= now() - interval '24 hours'
      GROUP BY sid
      ORDER BY success DESC, total DESC
      LIMIT 8
    `;

    return { hourly, today, yest, active: active?.n ?? 0, trending };
  });

// ---------- Summary daily series (for line chart + CSV) ----------
export const summaryDailyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), days: z.number().min(7).max(90).default(14) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const { sql } = await import("./db.server");

    const daily = await sql<any[]>`
      SELECT date_trunc('day', created_at)::date AS day,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status='success')::int AS success,
             COALESCE(SUM(payout_amount) FILTER (WHERE status='success'),0)::text AS earned
      FROM allocations
      WHERE user_id = ${auth.sub}
        AND created_at >= now() - (${data.days}::text || ' days')::interval
      GROUP BY day ORDER BY day ASC
    `;
    return { daily };
  });

// ---------- Summary detailed report (STEX-parity: per-day + totals + vs-prev) ----------
export const summaryReportFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), days: z.number().min(1).max(90).default(7) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const { sql } = await import("./db.server");
    const days = data.days;

    const rows = await sql<any[]>`
      WITH series AS (
        SELECT generate_series(current_date - (${days - 1}::int), current_date, '1 day'::interval)::date AS day
      ),
      agg AS (
        SELECT created_at::date AS day,
               COUNT(*)::int AS allocation,
               COUNT(*) FILTER (WHERE status='success')::int AS success,
               COUNT(*) FILTER (WHERE status IN ('failed','expired'))::int AS failed,
               COALESCE(SUM(payout_amount) FILTER (WHERE status='success'),0)::text AS amount
        FROM allocations
        WHERE user_id = ${auth.sub}
          AND created_at >= current_date - (${days - 1}::int)
        GROUP BY day
      )
      SELECT s.day,
             COALESCE(a.allocation,0) AS allocation,
             COALESCE(a.success,0)    AS success,
             COALESCE(a.failed,0)     AS failed,
             COALESCE(a.amount,'0')   AS amount
      FROM series s LEFT JOIN agg a USING (day)
      ORDER BY s.day ASC
    `;

    const [curr] = await sql<any[]>`
      SELECT COUNT(*)::int AS allocation,
             COUNT(*) FILTER (WHERE status='success')::int AS success,
             COUNT(*) FILTER (WHERE status IN ('failed','expired'))::int AS failed,
             COALESCE(SUM(payout_amount) FILTER (WHERE status='success'),0)::text AS amount
      FROM allocations
      WHERE user_id = ${auth.sub}
        AND created_at >= current_date - (${days - 1}::int)
    `;
    const [prev] = await sql<any[]>`
      SELECT COUNT(*)::int AS allocation,
             COUNT(*) FILTER (WHERE status='success')::int AS success,
             COUNT(*) FILTER (WHERE status IN ('failed','expired'))::int AS failed,
             COALESCE(SUM(payout_amount) FILTER (WHERE status='success'),0)::text AS amount
      FROM allocations
      WHERE user_id = ${auth.sub}
        AND created_at >= current_date - (${(days * 2 - 1)}::int)
        AND created_at <  current_date - (${days - 1}::int)
    `;

    return { rows, totals: curr, prevTotals: prev, days };
  });

// ---------- User's own allocations (persistent list with status filter) ----------
export const myAllocationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    status: z.enum(["all", "success", "failed", "pending"]).default("all"),
    search: z.string().trim().max(64).optional(),
    limit: z.number().min(1).max(200).default(50),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const { sql } = await import("./db.server");
    const { triggerPollerIngest } = await import("./poller.server");
    await triggerPollerIngest("allocations-refresh");

    const statusFilter = data.status === "all" ? null
      : data.status === "failed" ? ["failed", "expired"]
      : [data.status];
    const search = data.search?.length ? `%${data.search}%` : null;

    const rows = await sql<any[]>`
      SELECT a.id, a.full_number, a.national_number, a.no_plus_number, a.country, a.operator,
             a.sid, a.status, a.payout_amount::text AS payout_amount, a.created_at, a.completed_at, a.flags,
             latest_otp.body AS otp_body, latest_otp.received_at AS otp_received_at
      FROM allocations a
      LEFT JOIN LATERAL (
        SELECT m.body, m.received_at
        FROM otp_messages m
        WHERE m.allocation_id = a.id
           OR (m.user_id = a.user_id AND m.received_at >= a.created_at - interval '2 minutes' AND (
                regexp_replace(COALESCE(m.number,''), '\D','','g') = regexp_replace(COALESCE(a.full_number,''), '\D','','g')
             OR regexp_replace(COALESCE(m.number,''), '\D','','g') = regexp_replace(COALESCE(a.no_plus_number,''), '\D','','g')
             OR regexp_replace(COALESCE(m.number,''), '\D','','g') = regexp_replace(COALESCE(a.national_number,''), '\D','','g')
             OR regexp_replace(COALESCE(m.number,''), '\D','','g') LIKE '%' || regexp_replace(COALESCE(a.national_number,''), '\D','','g')
           ))
        ORDER BY m.received_at DESC
        LIMIT 1
      ) latest_otp ON true
      WHERE a.user_id = ${auth.sub}
        AND created_at >= now() - interval '24 hours'
        AND (${statusFilter}::text[] IS NULL OR status::text = ANY(${statusFilter}::text[]))
        AND (${search}::text IS NULL OR a.full_number ILIKE ${search} OR a.no_plus_number ILIKE ${search}
             OR a.national_number ILIKE ${search} OR COALESCE(a.sid,'') ILIKE ${search}
             OR COALESCE(a.country,'') ILIKE ${search})
      ORDER BY a.created_at DESC
      LIMIT ${data.limit}
    `;

    const [counts] = await sql<any[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status='success')::int AS success,
             COUNT(*) FILTER (WHERE status IN ('failed','expired'))::int AS failed,
             COUNT(*) FILTER (WHERE status='pending')::int AS pending
      FROM allocations
      WHERE user_id = ${auth.sub}
        AND created_at >= now() - interval '24 hours'
    `;

    return { rows, counts };
  });
