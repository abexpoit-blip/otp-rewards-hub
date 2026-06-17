/**
 * Admin server functions — withdrawal approval + payout config.
 * All require role=admin (checked via requireAdmin).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(1) });

// =====================================================================
// Withdrawals — admin views
// =====================================================================
export type AdminWithdrawalRow = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  amount: string;
  gateway: string;
  address: string;
  status: string;
  tx_id: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

export const adminListWithdrawalsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<AdminWithdrawalRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT w.id, w.user_id, u.email AS user_email, u.name AS user_name,
             w.amount::text, w.gateway, w.address, w.status, w.tx_id,
             w.admin_note, w.created_at, w.processed_at
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      ORDER BY
        CASE w.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1
                      WHEN 'paid' THEN 2 ELSE 3 END,
        w.created_at DESC
      LIMIT 200
    `;
    return rows.map((r) => ({
      id: r.id, user_id: r.user_id, user_email: r.user_email, user_name: r.user_name,
      amount: String(r.amount), gateway: r.gateway, address: r.address,
      status: r.status, tx_id: r.tx_id, admin_note: r.admin_note,
      created_at: r.created_at.toISOString(),
      processed_at: r.processed_at ? r.processed_at.toISOString() : null,
    }));
  });

const updateWdSchema = z.object({
  token: z.string().min(1),
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "paid"]),
  tx_id: z.string().trim().max(200).optional().nullable(),
  admin_note: z.string().trim().max(500).optional().nullable(),
});

export const adminUpdateWithdrawalFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateWdSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; status: string }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");

    return await sql.begin(async (tx) => {
      const [wd] = await tx<any[]>`
        SELECT id, user_id, amount::numeric AS amount, status
        FROM withdrawals WHERE id = ${data.id} FOR UPDATE
      `;
      if (!wd) throw new Error("Withdrawal not found");

      let newStatus: string;
      if (data.action === "approve") {
        if (wd.status !== "pending") throw new Error(`Cannot approve a ${wd.status} withdrawal`);
        newStatus = "approved";
      } else if (data.action === "paid") {
        if (wd.status !== "approved" && wd.status !== "pending") {
          throw new Error(`Cannot mark ${wd.status} as paid`);
        }
        newStatus = "paid";
      } else {
        // reject: refund balance back to user if currently pending or approved
        if (wd.status === "paid") throw new Error("Cannot reject a paid withdrawal");
        if (wd.status === "rejected") throw new Error("Already rejected");
        await tx`UPDATE users SET balance = balance + ${wd.amount} WHERE id = ${wd.user_id}`;
        newStatus = "rejected";
      }

      await tx`
        UPDATE withdrawals
        SET status = ${newStatus}::withdrawal_status,
            tx_id = COALESCE(${data.tx_id ?? null}, tx_id),
            admin_note = COALESCE(${data.admin_note ?? null}, admin_note),
            processed_by = ${admin.sub},
            processed_at = now()
        WHERE id = ${data.id}
      `;
      return { ok: true as const, status: newStatus };
    });
  });

// =====================================================================
// Service payouts — admin pricing
// =====================================================================
export type PayoutRow = {
  id: string;
  sid: string;
  country: string | null;
  amount: string;
  active: boolean;
  note: string | null;
  updated_at: string;
};

export const adminListPayoutsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<PayoutRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT id, sid, country, amount::text, active, note, updated_at
      FROM service_payouts
      ORDER BY sid ASC, country NULLS FIRST
    `;
    return rows.map((r) => ({
      id: r.id, sid: r.sid, country: r.country, amount: String(r.amount),
      active: r.active, note: r.note,
      updated_at: r.updated_at.toISOString(),
    }));
  });

const upsertPayoutSchema = z.object({
  token: z.string().min(1),
  sid: z.string().trim().min(1).max(80),
  country: z.string().trim().max(80).optional().nullable(),
  amount: z.number().min(0).max(1000),
  active: z.boolean().optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const adminUpsertPayoutFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertPayoutSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; id: string }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    // Normalise empty country to NULL
    const country = data.country?.trim() ? data.country.trim() : null;
    const [row] = await sql<any[]>`
      INSERT INTO service_payouts (sid, country, amount, active, note, created_by)
      VALUES (${data.sid}, ${country}, ${data.amount}, ${data.active ?? true},
              ${data.note ?? null}, ${admin.sub})
      ON CONFLICT (sid, COALESCE(country, ''))
      DO UPDATE SET amount = EXCLUDED.amount,
                    active = EXCLUDED.active,
                    note   = EXCLUDED.note,
                    updated_at = now()
      RETURNING id
    `;
    return { ok: true as const, id: row.id };
  });

const delPayoutSchema = z.object({ token: z.string().min(1), id: z.string().uuid() });

export const adminDeletePayoutFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => delPayoutSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    await sql`DELETE FROM service_payouts WHERE id = ${data.id}`;
    return { ok: true as const };
  });
