/**
 * Admin reporting — daily aggregates + poller health.
 * All require role=admin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(1) });
const rangeSchema = z.object({ token: z.string().min(1), days: z.number().int().min(1).max(90).optional() });

export type DailyReportRow = {
  day: string;
  total_allocations: number;
  success: number;
  expired: number;
  failed: number;
  pending: number;
  payout_total: string;
  active_users: number;
};

export const adminDailyReportFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data }): Promise<DailyReportRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const days = data.days ?? 14;
    const rows = await sql<any[]>`
      SELECT to_char(day, 'YYYY-MM-DD') AS day,
             total_allocations, success, expired, failed, pending,
             payout_total::text AS payout_total, active_users
      FROM daily_report
      WHERE day >= current_date - (${days}::int - 1)
      ORDER BY day DESC
    `;
    return rows as DailyReportRow[];
  });

export const adminPollerStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { getPollerStatus } = await import("./poller.server");
    const s = getPollerStatus();
    return {
      started: s.started,
      lastTickAgoMs: s.lastTick ? Date.now() - s.lastTick : null,
      lastError: s.lastError,
    };
  });
