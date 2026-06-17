/**
 * STEX server functions — called from client pages.
 * All require auth. OTP polling also runs ingestion → credits user balance.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(1) });
const allocSchema = z.object({ token: z.string().min(1), rid: z.string().min(2).max(64) });

// ---------- Live access (services + ranges from upstream) ----------
export const liveAccessFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    requireAuth(data.token);
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
    requireAuth(data.token);
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
    const auth = requireAuth(data.token);
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
    const [row] = await sql`
      INSERT INTO allocations (user_id, rid, full_number, national_number, no_plus_number, country, operator, status, stex_response)
      VALUES (${auth.sub}, ${data.rid}, ${n.full_number}, ${n.national_number}, ${n.no_plus_number}, ${n.country}, ${n.operator}, 'pending', ${JSON.stringify(r)}::jsonb)
      RETURNING id, full_number, national_number, country, operator, created_at
    `;
    return {
      id: row.id,
      full_number: row.full_number,
      national_number: row.national_number,
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
    requireAuth(data.token);
    const { sql } = await import("./db.server");
    const { stexSuccessOtp } = await import("./stex.server");

    const payout = Number(process.env.STEX_DEFAULT_PAYOUT || "0.10");
    const r = await stexSuccessOtp();
    if (r.meta.code !== 200 || !r.data) return { processed: 0, credited: 0 };

    let processed = 0;
    let credited = 0;

    for (const otp of r.data.otps) {
      // Match: any pending allocation whose no_plus_number or national_number
      // appears in this OTP's "number" (upstream returns no-plus international form).
      const matches = await sql<any[]>`
        SELECT id, user_id FROM allocations
        WHERE status = 'pending'
          AND (no_plus_number = ${otp.number} OR national_number = ${otp.number} OR full_number = ${"+" + otp.number})
        ORDER BY created_at DESC LIMIT 1
      `;
      if (matches.length === 0) continue;
      const alloc = matches[0];

      // Insert OTP (ON CONFLICT skip if already ingested)
      const inserted = await sql<any[]>`
        INSERT INTO otp_messages (allocation_id, user_id, number, body, stex_otp_id, received_at)
        VALUES (${alloc.id}, ${alloc.user_id}, ${otp.number}, ${otp.message}, ${otp.otp_id}, to_timestamp(${otp.time / 1000}))
        ON CONFLICT (stex_otp_id) DO NOTHING
        RETURNING id
      `;
      if (inserted.length === 0) continue; // already processed
      processed += 1;

      // Mark allocation success + credit balance
      await sql`
        UPDATE allocations
        SET status = 'success', payout_amount = ${payout}, completed_at = now()
        WHERE id = ${alloc.id}
      `;
      await sql`
        UPDATE users
        SET balance = balance + ${payout}, lifetime_earning = lifetime_earning + ${payout}
        WHERE id = ${alloc.user_id}
      `;
      credited += 1;
    }
    return { processed, credited };
  });

// ---------- Summary for the user ----------
export const summaryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const auth = requireAuth(data.token);
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
