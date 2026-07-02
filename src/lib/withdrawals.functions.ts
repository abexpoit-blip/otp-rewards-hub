import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WithdrawalRow = {
  id: string;
  amount: string;
  gateway: string;
  address: string;
  status: string;
  tx_id: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

export type PaymentAddressRow = {
  id: string;
  gateway: string;
  address: string;
  label: string | null;
  created_at: string;
};

const tokenSchema = z.object({ token: z.string().min(1) });

// ---------- Payment addresses ----------
export const listAddressesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<PaymentAddressRow[]> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const rows = await sql`
      SELECT id, gateway, address, label, created_at
      FROM payment_addresses WHERE user_id = ${auth.sub}
      ORDER BY created_at DESC
    `;
    return rows.map((r: any) => ({
      id: r.id, gateway: r.gateway, address: r.address, label: r.label,
      created_at: r.created_at.toISOString(),
    }));
  });

const addAddressSchema = z.object({
  token: z.string().min(1),
  gateway: z.string().trim().min(1).max(50),
  address: z.string().trim().min(3).max(200),
  label: z.string().trim().max(80).optional().nullable(),
});

export const addAddressFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => addAddressSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; id: string }> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const [row] = await sql`
      INSERT INTO payment_addresses (user_id, gateway, address, label)
      VALUES (${auth.sub}, ${data.gateway}, ${data.address}, ${data.label ?? null})
      RETURNING id
    `;
    return { ok: true, id: row.id };
  });

const delAddressSchema = z.object({
  token: z.string().min(1),
  id: z.string().uuid(),
});

export const deleteAddressFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => delAddressSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    await sql`DELETE FROM payment_addresses WHERE id = ${data.id} AND user_id = ${auth.sub}`;
    return { ok: true };
  });

// ---------- Withdrawals ----------
export const listWithdrawalsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<WithdrawalRow[]> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const rows = await sql`
      SELECT id, amount::text, gateway, address, status, tx_id, admin_note,
             created_at, processed_at
      FROM withdrawals WHERE user_id = ${auth.sub}
      ORDER BY created_at DESC LIMIT 50
    `;
    return rows.map((r: any) => ({
      id: r.id, amount: String(r.amount), gateway: r.gateway, address: r.address,
      status: r.status, tx_id: r.tx_id, admin_note: r.admin_note,
      created_at: r.created_at.toISOString(),
      processed_at: r.processed_at ? r.processed_at.toISOString() : null,
    }));
  });

const createWithdrawalSchema = z.object({
  token: z.string().min(1),
  amount: z.number().positive().max(1_000_000),
  gateway: z.string().trim().min(1).max(50),
  address: z.string().trim().min(3).max(200),
});

export const createWithdrawalFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createWithdrawalSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; id: string; status: string }> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);

    // Global minimum (admin-configurable via app_settings.min_withdraw)
    const { getSetting } = await import("./settings.server");
    const globalMin = Number(await getSetting("min_withdraw", 250));
    if (data.amount < globalMin) {
      throw new Error(`Minimum withdrawal amount is ৳${globalMin.toFixed(2)} BDT. You entered ৳${data.amount.toFixed(2)}.`);
    }

    // Validate gateway is enabled + within min/max
    const [gw] = await sql<any[]>`
      SELECT code, enabled, min_amount::numeric AS min_amount,
             max_amount::numeric AS max_amount,
             auto_approve_under::numeric AS auto_approve_under
      FROM payment_gateways WHERE code = ${data.gateway}
    `;
    if (!gw) throw new Error(`Unknown gateway: ${data.gateway}`);
    if (!gw.enabled) throw new Error(`Gateway "${data.gateway}" is currently disabled`);
    if (data.amount < Number(gw.min_amount)) throw new Error(`Minimum withdrawal for ${data.gateway} is ৳${Number(gw.min_amount).toFixed(2)} BDT`);
    if (data.amount > Number(gw.max_amount)) throw new Error(`Maximum withdrawal for ${data.gateway} is ৳${Number(gw.max_amount).toFixed(2)} BDT`);

    const autoApprove = gw.auto_approve_under != null && data.amount <= Number(gw.auto_approve_under);
    const initialStatus = autoApprove ? "approved" : "pending";

    // balance check + deduct in transaction
    const result = await sql.begin(async (tx) => {
      const [user] = await tx`
        SELECT balance::numeric AS balance FROM users WHERE id = ${auth.sub} FOR UPDATE
      `;
      if (!user) throw new Error("User not found");
      if (Number(user.balance) < data.amount) {
        throw new Error(`Insufficient balance. Current: ৳${Number(user.balance).toFixed(2)}`);
      }
      await tx`UPDATE users SET balance = balance - ${data.amount} WHERE id = ${auth.sub}`;
      const [wd] = await tx`
        INSERT INTO withdrawals (user_id, amount, gateway, address, status)
        VALUES (${auth.sub}, ${data.amount}, ${data.gateway}, ${data.address}, ${initialStatus}::withdrawal_status)
        RETURNING id
      `;
      return wd.id as string;
    });
    return { ok: true, id: result, status: initialStatus };
  });
