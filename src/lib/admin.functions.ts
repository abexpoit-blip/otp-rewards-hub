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

// =====================================================================
// Users — list / ban / credit / role
// =====================================================================
export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  balance: string;
  lifetime_earning: string;
  roles: string[];
  created_at: string;
  last_login_at: string | null;
  total_allocations: number;
  success_allocations: number;
};

export const adminListUsersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), search: z.string().optional() }).parse(d))
  .handler(async ({ data }): Promise<AdminUserRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const q = `%${(data.search ?? "").trim().toLowerCase()}%`;
    const rows = await sql<any[]>`
      SELECT u.id, u.email::text AS email, u.name, u.status::text AS status,
             u.balance::text AS balance, u.lifetime_earning::text AS lifetime_earning,
             u.created_at, u.last_login_at,
             u.banned_until, u.ban_reason, u.admin_notes,
             COALESCE(ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
             (SELECT COUNT(*)::int FROM allocations a WHERE a.user_id = u.id) AS total_allocations,
             (SELECT COUNT(*)::int FROM allocations a WHERE a.user_id = u.id AND a.status='success') AS success_allocations
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE (${data.search ?? ""} = '' OR lower(u.email::text) LIKE ${q} OR lower(COALESCE(u.name,'')) LIKE ${q})
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 200
    `;
    return rows.map((r) => ({
      ...r,
      created_at: r.created_at.toISOString(),
      last_login_at: r.last_login_at ? r.last_login_at.toISOString() : null,
      banned_until: r.banned_until ? r.banned_until.toISOString() : null,
    })) as AdminUserRow[];
  });

const userActionSchema = z.object({
  token: z.string().min(1),
  user_id: z.string().uuid(),
  action: z.enum([
    "block", "unblock", "credit", "debit",
    "grant_admin", "revoke_admin",
    "suspend", "unsuspend", "force_logout", "set_notes",
  ]),
  amount: z.number().optional(),
  note: z.string().max(2000).optional(),
  days: z.number().int().min(1).max(3650).optional(),
});

export const adminUserActionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => userActionSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");

    if (data.action === "block" || data.action === "unblock") {
      const status = data.action === "block" ? "blocked" : "active";
      const reason = data.action === "block" ? (data.note ?? null) : null;
      await sql`UPDATE users SET status = ${status}::user_status, ban_reason = ${reason} WHERE id = ${data.user_id}`;
    } else if (data.action === "suspend") {
      const days = data.days ?? 1;
      await sql`UPDATE users SET banned_until = now() + (${days} || ' days')::interval, ban_reason = ${data.note ?? null} WHERE id = ${data.user_id}`;
    } else if (data.action === "unsuspend") {
      await sql`UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE id = ${data.user_id}`;
    } else if (data.action === "force_logout") {
      if (data.user_id === admin.sub) throw new Error("You cannot force-logout yourself");
      await sql`UPDATE users SET tokens_invalidated_at = now() WHERE id = ${data.user_id}`;
    } else if (data.action === "set_notes") {
      await sql`UPDATE users SET admin_notes = ${data.note ?? null} WHERE id = ${data.user_id}`;
    } else if (data.action === "credit" || data.action === "debit") {
      const amt = Number(data.amount ?? 0);
      if (!isFinite(amt) || amt <= 0) throw new Error("Invalid amount");
      const delta = data.action === "credit" ? amt : -amt;
      await sql`UPDATE users SET balance = GREATEST(balance + ${delta}, 0) WHERE id = ${data.user_id}`;
    } else if (data.action === "grant_admin") {
      await sql`INSERT INTO user_roles (user_id, role) VALUES (${data.user_id}, 'admin') ON CONFLICT DO NOTHING`;
    } else if (data.action === "revoke_admin") {
      if (data.user_id === admin.sub) throw new Error("You cannot revoke your own admin role");
      await sql`DELETE FROM user_roles WHERE user_id = ${data.user_id} AND role = 'admin'`;
    }
    await audit(admin.sub, `user.${data.action}`, { type: "user", id: data.user_id }, { amount: data.amount, note: data.note, days: data.days });
    return { ok: true as const };
  });

// =====================================================================
// Settings — get / set (secrets are masked on read)
// =====================================================================
export const adminGetSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT key, value, is_secret, description, updated_at
      FROM app_settings ORDER BY key ASC
    `;
    return rows.map((r) => ({
      key: r.key as string,
      value: r.is_secret ? (r.value && r.value !== "" ? "********" : "") : r.value,
      is_secret: r.is_secret as boolean,
      description: r.description as string | null,
      updated_at: r.updated_at.toISOString(),
    }));
  });

const setSettingSchema = z.object({
  token: z.string().min(1),
  key: z.string().min(1).max(80),
  value: z.any(),
});

export const adminSetSettingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setSettingSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { setSetting } = await import("./settings.server");
    const { audit } = await import("./audit.server");
    const { sql } = await import("./db.server");
    const [meta] = await sql<any[]>`SELECT is_secret FROM app_settings WHERE key = ${data.key}`;
    if (!meta) throw new Error(`Unknown setting: ${data.key}`);
    await setSetting(data.key, data.value, admin.sub);
    await audit(admin.sub, "settings.update", { type: "setting", id: data.key },
      meta.is_secret ? { masked: true } : { value: data.value });
    return { ok: true as const };
  });

// =====================================================================
// Allocations — admin view + force expire
// =====================================================================
export type AdminAllocRow = {
  id: string;
  user_id: string;
  user_email: string;
  full_number: string;
  country: string | null;
  operator: string | null;
  sid: string | null;
  status: string;
  payout_amount: string;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
};

export const adminListAllocationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    status: z.enum(["all", "pending", "success", "expired", "failed"]).optional(),
    search: z.string().optional(),
    limit: z.number().int().min(10).max(500).optional(),
  }).parse(d))
  .handler(async ({ data }): Promise<AdminAllocRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const status = data.status ?? "all";
    const q = `%${(data.search ?? "").trim().toLowerCase()}%`;
    const limit = data.limit ?? 100;
    const rows = await sql<any[]>`
      SELECT a.id, a.user_id, u.email::text AS user_email,
             a.full_number, a.country, a.operator, a.sid, a.status::text AS status,
             a.payout_amount::text AS payout_amount,
             a.created_at, a.expires_at, a.completed_at
      FROM allocations a JOIN users u ON u.id = a.user_id
      WHERE (${status} = 'all' OR a.status::text = ${status})
        AND (${data.search ?? ""} = '' OR lower(u.email::text) LIKE ${q}
             OR a.full_number LIKE ${q} OR COALESCE(a.sid,'') ILIKE ${q})
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...r,
      created_at: r.created_at.toISOString(),
      expires_at: r.expires_at.toISOString(),
      completed_at: r.completed_at ? r.completed_at.toISOString() : null,
    })) as AdminAllocRow[];
  });

export const adminForceExpireAllocFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");
    await sql`UPDATE allocations SET status = 'expired', completed_at = now()
              WHERE id = ${data.id} AND status = 'pending'`;
    await audit(admin.sub, "allocation.force_expire", { type: "allocation", id: data.id });
    return { ok: true as const };
  });
