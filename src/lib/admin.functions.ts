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
  banned_until: string | null;
  ban_reason: string | null;
  admin_notes: string | null;
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
// Delete user (hard delete; cascades to sessions/allocations/api_keys/etc).
// Safety: cannot delete yourself; cannot delete admins; refuses if pending withdrawal.
// =====================================================================
const deleteUserSchema = z.object({
  token: z.string().min(1),
  user_id: z.string().uuid(),
  confirm_email: z.string().email(),
});

export const adminDeleteUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => deleteUserSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; email: string }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");

    if (data.user_id === admin.sub) throw new Error("You cannot delete your own account.");

    const [u] = await sql<any[]>`SELECT id, email::text AS email FROM users WHERE id = ${data.user_id}`;
    if (!u) throw new Error("User not found.");
    if (u.email.toLowerCase() !== data.confirm_email.toLowerCase()) {
      throw new Error("Email confirmation does not match.");
    }
    const [isAdmin] = await sql<{ ok: boolean }[]>`SELECT has_role(${data.user_id}::uuid, 'admin') AS ok`;
    if (isAdmin?.ok) throw new Error("Refuse: target is an admin. Revoke admin first.");

    const [pending] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM withdrawals
      WHERE user_id = ${data.user_id} AND status IN ('pending','approved')
    `;
    if ((pending?.n ?? 0) > 0) throw new Error("Refuse: user has pending/approved withdrawals.");

    await sql`DELETE FROM users WHERE id = ${data.user_id}`;
    await audit(admin.sub, "user.delete", { type: "user", id: data.user_id }, { email: u.email });
    return { ok: true as const, email: u.email };
  });

// =====================================================================
// Impersonate — admin gets a token for another user. Audited.
// =====================================================================
const impersonateSchema = z.object({ token: z.string().min(1), user_id: z.string().uuid() });

export const adminImpersonateFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => impersonateSchema.parse(d))
  .handler(async ({ data }): Promise<{ token: string; user: any }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { signToken } = await import("./jwt.server");
    const { audit } = await import("./audit.server");

    if (data.user_id === admin.sub) throw new Error("You are already this user.");

    const [u] = await sql<any[]>`
      SELECT id, email::text AS email, name, phone,
             balance::text AS balance, lifetime_earning::text AS lifetime_earning
      FROM users WHERE id = ${data.user_id}
    `;
    if (!u) throw new Error("User not found.");

    const roleRows = await sql<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${data.user_id}
    `;
    const roles = roleRows.map((r) => r.role);
    if (roles.length === 0) roles.push("user");

    const token = signToken({ sub: u.id, email: u.email, roles });
    await audit(admin.sub, "user.impersonate", { type: "user", id: data.user_id }, { email: u.email });
    return { token, user: { ...u, roles } };
  });

// =====================================================================
// Manual cleanup trigger — same SQL the cron job runs.
// =====================================================================
const cleanupSchema = z.object({ token: z.string().min(1), days: z.number().int().min(7).max(365).optional() });

export const adminCleanupInactiveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cleanupSchema.parse(d))
  .handler(async ({ data }): Promise<{ deleted: number; days: number }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");
    const days = data.days ?? 14;
    const [r] = await sql<{ deleted: number }[]>`
      SELECT cleanup_inactive_users(${days})::int AS deleted
    `;
    await audit(admin.sub, "users.cleanup_inactive", { type: "system", id: "cleanup" }, { days, deleted: r?.deleted ?? 0 });
    return { deleted: r?.deleted ?? 0, days };
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

export type AdminAllocListResult = { rows: AdminAllocRow[]; total: number };

export const adminListAllocationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    status: z.enum(["all", "pending", "success", "expired", "failed"]).optional(),
    range: z.enum(["all", "today", "7d", "30d"]).optional(),
    search: z.string().optional(),
    limit: z.number().int().min(10).max(500).optional(),
    offset: z.number().int().min(0).max(100000).optional(),
  }).parse(d))
  .handler(async ({ data }): Promise<AdminAllocListResult> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    await sql`UPDATE allocations SET status='failed', completed_at=COALESCE(completed_at, now()) WHERE status='pending' AND expires_at < now()`;
    const status = data.status ?? "all";
    const range = data.range ?? "all";
    const q = `%${(data.search ?? "").trim().toLowerCase()}%`;
    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;
    const [countRow] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM allocations a JOIN users u ON u.id = a.user_id
      WHERE (${status} = 'all' OR a.status::text = ${status})
        AND (${range} = 'all'
             OR (${range} = 'today' AND a.created_at >= date_trunc('day', now()))
             OR (${range} = '7d'    AND a.created_at >= now() - interval '7 days')
             OR (${range} = '30d'   AND a.created_at >= now() - interval '30 days'))
        AND (${data.search ?? ""} = '' OR lower(u.email::text) LIKE ${q}
             OR a.full_number LIKE ${q} OR COALESCE(a.sid,'') ILIKE ${q})
    `;
    const rows = await sql<any[]>`
      SELECT a.id, a.user_id, u.email::text AS user_email,
             a.full_number, a.country, a.operator, a.sid, a.status::text AS status,
             a.payout_amount::text AS payout_amount,
             a.created_at, a.expires_at, a.completed_at
      FROM allocations a JOIN users u ON u.id = a.user_id
      WHERE (${status} = 'all' OR a.status::text = ${status})
        AND (${range} = 'all'
             OR (${range} = 'today' AND a.created_at >= date_trunc('day', now()))
             OR (${range} = '7d'    AND a.created_at >= now() - interval '7 days')
             OR (${range} = '30d'   AND a.created_at >= now() - interval '30 days'))
        AND (${data.search ?? ""} = '' OR lower(u.email::text) LIKE ${q}
             OR a.full_number LIKE ${q} OR COALESCE(a.sid,'') ILIKE ${q})
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return {
      total: countRow?.n ?? 0,
      rows: rows.map((r) => ({
        ...r,
        created_at: r.created_at.toISOString(),
        expires_at: r.expires_at.toISOString(),
        completed_at: r.completed_at ? r.completed_at.toISOString() : null,
      })) as AdminAllocRow[],
    };
  });

export const adminForceExpireAllocFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");
    await sql`UPDATE allocations SET status = 'failed', completed_at = now()
              WHERE id = ${data.id} AND status = 'pending'`;
    await audit(admin.sub, "allocation.force_expire", { type: "allocation", id: data.id });
    return { ok: true as const };
  });

// =====================================================================
// Dashboard — aggregated stats for /admin home
// =====================================================================
export type AdminDashboardStats = {
  users: {
    total: number; active: number; blocked: number; suspended: number;
    new_today: number; new_7d: number;
  };
  // "numbers" = allocations issued to users (a number request).
  numbers: {
    total: number; success: number; pending: number; expired: number;
    today: number; success_today: number;
  };
  // "otps_received" = actual SMS messages that arrived from STEX.
  otps_received: { total: number; today: number };
  money: {
    total_earned: string; total_balance: string; earned_today: string;
    pending_withdraw: string; paid_withdraw: string;
  };
  top_users: Array<{
    id: string; email: string; name: string | null;
    lifetime_earning: string; balance: string;
    success_count: number; total_count: number;
  }>;
  recent_users: Array<{
    id: string; email: string; name: string | null;
    created_at: string; total_count: number;
  }>;
  top_ranges: Array<{ range_label: string; count: number; success: number }>;
  recent_otps: Array<{
    id: string; user_email: string; full_number: string;
    sid: string | null; status: string; payout_amount: string; created_at: string;
  }>;
  trend_7d: Array<{ day: string; total: number; success: number; earned: number }>;
};

export const adminDashboardStatsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<AdminDashboardStats> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");

    // Real-time accuracy: sweep any pending allocations whose 20-min window
    // has passed before we count. Cheap (partial index on expires_at) and
    // guarantees the dashboard reflects reality, not stale poller state.
    await sql`
      UPDATE allocations
      SET status = 'failed', completed_at = COALESCE(completed_at, now())
      WHERE status = 'pending' AND expires_at < now()
    `;


    const [u] = await sql<any[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE status='blocked')::int AS blocked,
        COUNT(*) FILTER (WHERE banned_until IS NOT NULL AND banned_until > now())::int AS suspended,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS new_today,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS new_7d
      FROM users
    `;

    const [o] = await sql<any[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='success')::int AS success,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status IN ('failed','expired'))::int AS expired,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
        COUNT(*) FILTER (WHERE status='success' AND completed_at >= date_trunc('day', now()))::int AS success_today
      FROM allocations
    `;

    const [m] = await sql<any[]>`
      SELECT
        COALESCE(SUM(lifetime_earning),0)::text AS total_earned,
        COALESCE(SUM(balance),0)::text AS total_balance
      FROM users
    `;
    const [et] = await sql<any[]>`
      SELECT COALESCE(SUM(payout_amount),0)::text AS earned_today
      FROM allocations
      WHERE status='success' AND completed_at >= date_trunc('day', now())
    `;
    const [w] = await sql<any[]>`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status='pending'),0)::text AS pending_withdraw,
        COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)::text AS paid_withdraw
      FROM withdrawals
    `;

    const topUsers = await sql<any[]>`
      SELECT u.id, u.email::text AS email, u.name,
             u.lifetime_earning::text AS lifetime_earning,
             u.balance::text AS balance,
             (SELECT COUNT(*)::int FROM allocations a WHERE a.user_id=u.id AND a.status='success') AS success_count,
             (SELECT COUNT(*)::int FROM allocations a WHERE a.user_id=u.id) AS total_count
      FROM users u
      ORDER BY u.lifetime_earning DESC NULLS LAST
      LIMIT 10
    `;

    const recentUsers = await sql<any[]>`
      SELECT u.id, u.email::text AS email, u.name, u.created_at,
             (SELECT COUNT(*)::int FROM allocations a WHERE a.user_id=u.id) AS total_count
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 10
    `;

    const topRanges = await sql<any[]>`
      SELECT
        COALESCE(country,'?') || ' / ' || COALESCE(operator,'?') AS range_label,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE status='success')::int AS success
      FROM allocations
      WHERE created_at >= now() - interval '30 days'
      GROUP BY range_label
      ORDER BY count DESC
      LIMIT 10
    `;

    const recentOtps = await sql<any[]>`
      SELECT a.id, u.email::text AS user_email, a.full_number, a.sid,
             a.status::text AS status, a.payout_amount::text AS payout_amount, a.created_at
      FROM allocations a JOIN users u ON u.id=a.user_id
      ORDER BY a.created_at DESC
      LIMIT 20
    `;

    const trendRows = await sql<any[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', now()) - interval '6 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS day
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(COUNT(a.id),0)::int AS total,
        COALESCE(COUNT(a.id) FILTER (WHERE a.status='success'),0)::int AS success,
        COALESCE(SUM(a.payout_amount) FILTER (WHERE a.status='success'),0)::text AS earned
      FROM days d
      LEFT JOIN allocations a ON date_trunc('day', a.created_at) = d.day
      GROUP BY d.day
      ORDER BY d.day ASC
    `;

    const [rx] = await sql<any[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE received_at >= date_trunc('day', now()))::int AS today
      FROM otp_messages
    `;

    return {
      users: {
        total: u.total, active: u.active, blocked: u.blocked,
        suspended: u.suspended, new_today: u.new_today, new_7d: u.new_7d,
      },
      numbers: {
        total: o.total, success: o.success, pending: o.pending,
        expired: o.expired, today: o.today, success_today: o.success_today,
      },
      otps_received: { total: rx?.total ?? 0, today: rx?.today ?? 0 },
      money: {
        total_earned: String(m.total_earned),
        total_balance: String(m.total_balance),
        earned_today: String(et.earned_today),
        pending_withdraw: String(w.pending_withdraw),
        paid_withdraw: String(w.paid_withdraw),
      },
      top_users: topUsers.map((r) => ({
        id: r.id, email: r.email, name: r.name,
        lifetime_earning: String(r.lifetime_earning),
        balance: String(r.balance),
        success_count: r.success_count, total_count: r.total_count,
      })),
      recent_users: recentUsers.map((r) => ({
        id: r.id, email: r.email, name: r.name,
        created_at: r.created_at.toISOString(),
        total_count: r.total_count,
      })),
      top_ranges: topRanges.map((r) => ({
        range_label: r.range_label, count: r.count, success: r.success,
      })),
      recent_otps: recentOtps.map((r) => ({
        id: r.id, user_email: r.user_email, full_number: r.full_number,
        sid: r.sid, status: r.status,
        payout_amount: String(r.payout_amount),
        created_at: r.created_at.toISOString(),
      })),
      trend_7d: trendRows.map((r) => ({
        day: r.day,
        total: r.total,
        success: r.success,
        earned: Number(r.earned ?? 0),
      })),
    };
  });

// =====================================================================
// OTP Messages — admin drilldown (incoming SMS from STEX)
// =====================================================================
export type AdminOtpRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  allocation_id: string | null;
  number: string | null;
  sender: string | null;
  body: string;
  country: string | null;
  carrier: string | null;
  received_at: string;
};

export type AdminOtpListResult = { rows: AdminOtpRow[]; total: number };

export const adminListOtpsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    range: z.enum(["all", "today", "7d", "30d"]).optional(),
    search: z.string().optional(),
    limit: z.number().int().min(10).max(500).optional(),
    offset: z.number().int().min(0).max(100000).optional(),
  }).parse(d))
  .handler(async ({ data }): Promise<AdminOtpListResult> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const range = data.range ?? "all";
    const q = `%${(data.search ?? "").trim().toLowerCase()}%`;
    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;
    const [countRow] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM otp_messages o
      LEFT JOIN users u ON u.id = o.user_id
      WHERE (${range} = 'all'
             OR (${range} = 'today' AND o.received_at >= date_trunc('day', now()))
             OR (${range} = '7d'    AND o.received_at >= now() - interval '7 days')
             OR (${range} = '30d'   AND o.received_at >= now() - interval '30 days'))
        AND (${data.search ?? ""} = ''
             OR lower(COALESCE(u.email::text,'')) LIKE ${q}
             OR COALESCE(o.number,'') LIKE ${q}
             OR COALESCE(o.sender,'') ILIKE ${q}
             OR lower(o.body) LIKE ${q})
    `;
    const rows = await sql<any[]>`
      SELECT o.id, o.user_id, u.email::text AS user_email,
             o.allocation_id, o.number, o.sender, o.body,
             o.country, o.carrier, o.received_at
      FROM otp_messages o
      LEFT JOIN users u ON u.id = o.user_id
      WHERE (${range} = 'all'
             OR (${range} = 'today' AND o.received_at >= date_trunc('day', now()))
             OR (${range} = '7d'    AND o.received_at >= now() - interval '7 days')
             OR (${range} = '30d'   AND o.received_at >= now() - interval '30 days'))
        AND (${data.search ?? ""} = ''
             OR lower(COALESCE(u.email::text,'')) LIKE ${q}
             OR COALESCE(o.number,'') LIKE ${q}
             OR COALESCE(o.sender,'') ILIKE ${q}
             OR lower(o.body) LIKE ${q})
      ORDER BY o.received_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return {
      total: countRow?.n ?? 0,
      rows: rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        user_email: r.user_email,
        allocation_id: r.allocation_id,
        number: r.number,
        sender: r.sender,
        body: r.body,
        country: r.country,
        carrier: r.carrier,
        received_at: r.received_at.toISOString(),
      })),
    };
  });

// =====================================================================
// AGENTS — admin manages sub-admin (agent) accounts
// =====================================================================
export type AdminAgentRow = {
  id: string; email: string; name: string | null;
  otp_rate: string; agent_active: boolean; status: string;
  users_under: number; pending_under: number;
  otps_total: number; otps_7d: number;
  created_at: string; last_login_at: string | null;
};

export const adminListAgentsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<AdminAgentRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT u.id, u.email::text AS email, u.name,
             u.otp_rate::text AS otp_rate, u.agent_active,
             u.status::text AS status, u.created_at, u.last_login_at,
             (SELECT COUNT(*)::int FROM users x WHERE x.agent_id = u.id) AS users_under,
             (SELECT COUNT(*)::int FROM users x WHERE x.agent_id = u.id AND x.status = 'pending') AS pending_under,
             (SELECT COUNT(*)::int FROM allocations a
                JOIN users x ON x.id = a.user_id
               WHERE x.agent_id = u.id AND a.status = 'success') AS otps_total,
             (SELECT COUNT(*)::int FROM allocations a
                JOIN users x ON x.id = a.user_id
               WHERE x.agent_id = u.id AND a.status = 'success'
                 AND a.completed_at >= now() - interval '7 days') AS otps_7d
      FROM users u
      WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'agent')
      ORDER BY otps_total DESC, u.created_at DESC
    `;
    return rows.map((r) => ({
      ...r, otp_rate: String(r.otp_rate),
      otps_total: Number(r.otps_total), otps_7d: Number(r.otps_7d),
      created_at: r.created_at.toISOString(),
      last_login_at: r.last_login_at ? r.last_login_at.toISOString() : null,
    })) as AdminAgentRow[];
  });


const createAgentSchema = z.object({
  token: z.string().min(1),
  // Admin enters a short username (letters/digits/dot/dash/underscore).
  // Server appends the configured domain (default v2.nexus-x.site).
  username: z.string().trim().toLowerCase()
    .min(2).max(64)
    .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i, "Username: letters, digits, dot, dash, underscore only"),
  password: z.string().min(6).max(200),
  name: z.string().trim().max(120).optional().nullable(),
  otp_rate: z.number().min(0).max(0.70),
});

export const adminCreateAgentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createAgentSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; id: string; email: string }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { hashPassword } = await import("./password.server");
    const { audit } = await import("./audit.server");
    const { getSetting } = await import("./settings.server");

    const cap = Number(await getSetting("max_agent_otp_rate", 0.70));
    if (data.otp_rate > cap) throw new Error(`OTP rate exceeds cap of ৳${cap}`);

    const domainRaw = String(await getSetting("agent_email_domain", "v2.nexus-x.site")).trim().replace(/^@+/, "");
    const email = `${data.username}@${domainRaw}`.toLowerCase();

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) throw new Error(`Username already taken (${email}).`);

    const hash = await hashPassword(data.password);
    const [u] = await sql<any[]>`
      INSERT INTO users (email, password_hash, name, status, otp_rate, agent_active)
      VALUES (${email}, ${hash}, ${data.name ?? null}, 'active', ${data.otp_rate}::numeric, true)
      RETURNING id
    `;
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${u.id}, 'agent'), (${u.id}, 'user') ON CONFLICT DO NOTHING`;
    await audit(admin.sub, "agent.create", { type: "user", id: u.id }, { email, otp_rate: data.otp_rate });
    return { ok: true as const, id: u.id, email };
  });

// Public read: which domain to show in admin UI as a preview.
export const adminGetAgentDomainFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<{ domain: string }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { getSetting } = await import("./settings.server");
    const d = String(await getSetting("agent_email_domain", "v2.nexus-x.site")).trim().replace(/^@+/, "");
    return { domain: d };
  });

const updateAgentSchema = z.object({
  token: z.string().min(1),
  agent_id: z.string().uuid(),
  otp_rate: z.number().min(0).max(0.70).optional(),
  agent_active: z.boolean().optional(),
  password: z.string().min(6).max(200).optional(),
  name: z.string().trim().max(120).optional().nullable(),
});

export const adminUpdateAgentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateAgentSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { hashPassword } = await import("./password.server");
    const { audit } = await import("./audit.server");
    const { getSetting } = await import("./settings.server");

    const [a] = await sql<any[]>`
      SELECT u.id, u.email::text AS email FROM users u WHERE u.id = ${data.agent_id}
        AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'agent')
    `;
    if (!a) throw new Error("Agent not found");

    if (data.otp_rate !== undefined) {
      const cap = Number(await getSetting("max_agent_otp_rate", 0.70));
      if (data.otp_rate > cap) throw new Error(`OTP rate exceeds cap of ৳${cap}`);
      await sql`UPDATE users SET otp_rate = ${data.otp_rate}::numeric WHERE id = ${data.agent_id}`;
    }
    if (data.agent_active !== undefined) {
      await sql`UPDATE users SET agent_active = ${data.agent_active} WHERE id = ${data.agent_id}`;
    }
    if (data.name !== undefined) {
      await sql`UPDATE users SET name = ${data.name} WHERE id = ${data.agent_id}`;
    }
    if (data.password) {
      const hash = await hashPassword(data.password);
      await sql`UPDATE users SET password_hash = ${hash}, tokens_invalidated_at = now() WHERE id = ${data.agent_id}`;
    }
    await audit(admin.sub, "agent.update", { type: "user", id: data.agent_id }, { fields: Object.keys(data).filter(k => k !== "token" && k !== "agent_id" && k !== "password") });
    return { ok: true as const };
  });

export const adminToggleSupportFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; enabled: boolean }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { setSetting } = await import("./settings.server");
    await setSetting("support_enabled", data.enabled, admin.sub);
    return { ok: true as const, enabled: data.enabled };
  });

