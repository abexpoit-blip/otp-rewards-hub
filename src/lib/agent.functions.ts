/**
 * Agent server functions — under-agent user management, withdrawals, dashboard.
 * Admins can also access (they have the agent role).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(1) });

// =====================================================================
// Dashboard stats (under-agent scope; admin sees all agents' totals
// because we scope by users.agent_id which only matches their own).
// =====================================================================
export const agentDashboardStatsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const [r] = await sql<any[]>`
      WITH my_users AS (
        SELECT id FROM users WHERE agent_id = ${auth.sub}
      )
      SELECT
        (SELECT COUNT(*)::int FROM my_users)                                                    AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE agent_id = ${auth.sub} AND status = 'pending')   AS pending_users,
        (SELECT COUNT(*)::int FROM users WHERE agent_id = ${auth.sub} AND status = 'active')    AS active_users,
        (SELECT COUNT(*)::int FROM otp_messages om
           JOIN my_users mu ON mu.id = om.user_id
           WHERE om.received_at::date = current_date)                                            AS otps_today,
        (SELECT COUNT(*)::int FROM otp_messages om
           JOIN my_users mu ON mu.id = om.user_id)                                               AS otps_total,
        (SELECT COALESCE(SUM(payout_amount),0)::numeric FROM allocations a
           JOIN my_users mu ON mu.id = a.user_id
           WHERE a.status = 'success' AND a.completed_at::date = current_date)::text            AS earned_today,
        (SELECT COALESCE(SUM(lifetime_earning),0)::numeric FROM users WHERE agent_id = ${auth.sub})::text AS lifetime_earned,
        (SELECT COUNT(*)::int FROM withdrawals w
           JOIN my_users mu ON mu.id = w.user_id
           WHERE w.status = 'pending')                                                          AS pending_withdrawals
    `;
    return {
      total_users: r?.total_users ?? 0,
      pending_users: r?.pending_users ?? 0,
      active_users: r?.active_users ?? 0,
      otps_today: r?.otps_today ?? 0,
      otps_total: r?.otps_total ?? 0,
      earned_today: String(r?.earned_today ?? "0"),
      lifetime_earned: String(r?.lifetime_earned ?? "0"),
      pending_withdrawals: r?.pending_withdrawals ?? 0,
    };
  });

// =====================================================================
// Users under this agent
// =====================================================================
export type AgentUserRow = {
  id: string; email: string; name: string | null; phone: string | null;
  status: string; balance: string; lifetime_earning: string;
  otp_rate: string; created_at: string; last_login_at: string | null;
  total_allocations: number; success_allocations: number;
};

export const agentListUsersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    search: z.string().optional(),
    status: z.enum(["all","pending","active","blocked"]).optional(),
  }).parse(d))
  .handler(async ({ data }): Promise<AgentUserRow[]> => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const q = `%${(data.search ?? "").trim().toLowerCase()}%`;
    const status = data.status ?? "all";
    const rows = await sql<any[]>`
      SELECT u.id, u.email::text AS email, u.name, u.phone,
             u.status::text AS status, u.balance::text, u.lifetime_earning::text,
             u.otp_rate::text, u.created_at, u.last_login_at,
             (SELECT COUNT(*)::int FROM allocations a WHERE a.user_id = u.id) AS total_allocations,
             (SELECT COUNT(*)::int FROM allocations a WHERE a.user_id = u.id AND a.status='success') AS success_allocations
      FROM users u
      WHERE u.agent_id = ${auth.sub}
        AND (${status} = 'all' OR u.status::text = ${status})
        AND (${data.search ?? ""} = '' OR lower(u.email::text) LIKE ${q} OR lower(COALESCE(u.name,'')) LIKE ${q})
      ORDER BY
        CASE u.status::text WHEN 'pending' THEN 0 ELSE 1 END,
        u.created_at DESC
      LIMIT 300
    `;
    return rows.map((r) => ({
      ...r,
      balance: String(r.balance), lifetime_earning: String(r.lifetime_earning),
      otp_rate: String(r.otp_rate),
      created_at: r.created_at.toISOString(),
      last_login_at: r.last_login_at ? r.last_login_at.toISOString() : null,
    }));
  });

// =====================================================================
// Approve / Reject pending users
// =====================================================================
const approveSchema = z.object({
  token: z.string().min(1),
  user_id: z.string().uuid(),
  action: z.enum(["approve","reject"]),
});

export const agentApproveUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => approveSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");

    const [u] = await sql<any[]>`
      SELECT id, email::text AS email, agent_id, status::text AS status
      FROM users WHERE id = ${data.user_id}
    `;
    if (!u) throw new Error("User not found");
    if (u.agent_id !== auth.sub) throw new Error("This user is not under your agent account");
    if (u.status !== "pending") throw new Error(`User is already ${u.status}`);

    if (data.action === "approve") {
      await sql`UPDATE users SET status = 'active' WHERE id = ${data.user_id}`;
      await audit(auth.sub, "agent.approve_user", { type: "user", id: data.user_id }, { email: u.email });
      return { ok: true as const, status: "active" };
    } else {
      // Reject = delete (no balance, no history yet)
      await sql`DELETE FROM users WHERE id = ${data.user_id}`;
      await audit(auth.sub, "agent.reject_user", { type: "user", id: data.user_id }, { email: u.email });
      return { ok: true as const, status: "rejected" };
    }
  });

// =====================================================================
// User details (read-only) — OTP body masked
// =====================================================================
export const agentUserDetailsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const [u] = await sql<any[]>`
      SELECT id, email::text AS email, name, phone, status::text AS status,
             balance::text, lifetime_earning::text, otp_rate::text,
             created_at, last_login_at
      FROM users WHERE id = ${data.user_id} AND agent_id = ${auth.sub}
    `;
    if (!u) throw new Error("User not found or not under your agent");
    const allocs = await sql<any[]>`
      SELECT id, full_number, country, status::text AS status,
             payout_amount::text AS payout_amount, created_at, completed_at
      FROM allocations WHERE user_id = ${data.user_id}
      ORDER BY created_at DESC LIMIT 50
    `;
    const otps = await sql<any[]>`
      SELECT id, number, sender, received_at
      FROM otp_messages WHERE user_id = ${data.user_id}
      ORDER BY received_at DESC LIMIT 50
    `;
    return {
      user: {
        ...u,
        balance: String(u.balance), lifetime_earning: String(u.lifetime_earning),
        otp_rate: String(u.otp_rate),
        created_at: u.created_at.toISOString(),
        last_login_at: u.last_login_at ? u.last_login_at.toISOString() : null,
      },
      allocations: allocs.map((a) => ({
        ...a, payout_amount: String(a.payout_amount),
        created_at: a.created_at.toISOString(),
        completed_at: a.completed_at ? a.completed_at.toISOString() : null,
      })),
      otps: otps.map((o) => ({
        id: o.id, number: o.number, sender: o.sender,
        body_masked: "•••• OTP hidden for privacy ••••",
        received_at: o.received_at.toISOString(),
      })),
    };
  });

// =====================================================================
// Withdrawals under this agent
// =====================================================================
export const agentListWithdrawalsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT w.id, w.user_id, u.email::text AS user_email, u.name AS user_name,
             w.amount::text, w.gateway, w.address, w.status, w.tx_id,
             w.admin_note, w.created_at, w.processed_at
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      WHERE u.agent_id = ${auth.sub}
      ORDER BY
        CASE w.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1
                      WHEN 'paid' THEN 2 ELSE 3 END,
        w.created_at DESC
      LIMIT 200
    `;
    return rows.map((r) => ({
      ...r, amount: String(r.amount),
      created_at: r.created_at.toISOString(),
      processed_at: r.processed_at ? r.processed_at.toISOString() : null,
    }));
  });

const updateWdSchema = z.object({
  token: z.string().min(1),
  id: z.string().uuid(),
  action: z.enum(["approve","reject","paid"]),
  tx_id: z.string().trim().max(200).optional().nullable(),
  admin_note: z.string().trim().max(500).optional().nullable(),
});

export const agentUpdateWithdrawalFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateWdSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");

    return await sql.begin(async (tx) => {
      const [wd] = await tx<any[]>`
        SELECT w.id, w.user_id, w.amount::numeric AS amount, w.status, u.agent_id
        FROM withdrawals w
        JOIN users u ON u.id = w.user_id
        WHERE w.id = ${data.id} FOR UPDATE
      `;
      if (!wd) throw new Error("Withdrawal not found");
      if (wd.agent_id !== auth.sub) throw new Error("This withdrawal is not under your agent account");

      let newStatus: string;
      if (data.action === "approve") {
        if (wd.status !== "pending") throw new Error(`Cannot approve a ${wd.status} withdrawal`);
        newStatus = "approved";
      } else if (data.action === "paid") {
        if (wd.status !== "approved" && wd.status !== "pending") throw new Error(`Cannot mark ${wd.status} as paid`);
        newStatus = "paid";
      } else {
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
            processed_by = ${auth.sub},
            processed_at = now()
        WHERE id = ${data.id}
      `;
      await audit(auth.sub, `agent.withdrawal.${data.action}`, { type: "withdrawal", id: data.id }, { amount: wd.amount });
      return { ok: true as const, status: newStatus };
    });
  });
