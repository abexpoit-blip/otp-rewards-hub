import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type OtpRow = {
  id: string;
  number: string | null;
  sender: string | null;
  body: string;
  carrier: string | null;
  country: string | null;
  received_at: string;
};

export type AllocationRow = {
  id: string;
  full_number: string | null;
  country: string | null;
  operator: string | null;
  status: string;
  payout_amount: string;
  created_at: string;
  completed_at: string | null;
};

const tokenSchema = z.object({ token: z.string().min(1) });

export const getOtpsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<OtpRow[]> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const { triggerPollerIngest } = await import("./poller.server");
    await triggerPollerIngest("inbox-refresh");
    const rows = await sql`
      SELECT id, number, sender, body, carrier, country, received_at
      FROM otp_messages
      WHERE user_id = ${auth.sub}
      ORDER BY received_at DESC LIMIT 100
    `;
    return rows.map((r: any) => ({
      id: r.id, number: r.number, sender: r.sender, body: r.body,
      carrier: r.carrier, country: r.country,
      received_at: r.received_at.toISOString(),
    }));
  });

export const getAllocationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<AllocationRow[]> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const rows = await sql`
      SELECT id, full_number, country, operator, status,
             payout_amount::text, created_at, completed_at
      FROM allocations
      WHERE user_id = ${auth.sub}
      ORDER BY created_at DESC LIMIT 50
    `;
    return rows.map((r: any) => ({
      id: r.id, full_number: r.full_number, country: r.country,
      operator: r.operator, status: r.status,
      payout_amount: String(r.payout_amount),
      created_at: r.created_at.toISOString(),
      completed_at: r.completed_at ? r.completed_at.toISOString() : null,
    }));
  });
