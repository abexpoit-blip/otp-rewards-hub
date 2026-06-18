/**
 * Sprint 1 — Notice/Announcement + Audit list server functions.
 * - Admin: CRUD notices, list audit log
 * - Public (authenticated): fetch active notices to render banner/popup
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// =====================================================================
// Types
// =====================================================================
export type NoticeRow = {
  id: string;
  type: "banner" | "popup";
  priority: "info" | "warning" | "critical";
  title: string;
  body: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  target_user_ids: string[] | null;     // NULL/empty = all users
  target_emails?: string[];             // admin-list convenience
  created_at: string;
  updated_at: string;
};

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: any;
  created_at: string;
};

// =====================================================================
// Admin: List notices (all, active + inactive)
// =====================================================================
export const adminListNoticesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<NoticeRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT n.id, n.type::text AS type, n.priority::text AS priority,
             n.title, n.body, n.active, n.starts_at, n.ends_at,
             n.target_user_ids, n.created_at, n.updated_at,
             COALESCE(
               (SELECT array_agg(u.email::text)
                FROM users u WHERE u.id = ANY(n.target_user_ids)),
               '{}'
             ) AS target_emails
      FROM notices n ORDER BY n.created_at DESC LIMIT 200
    `;
    return rows.map((r) => ({
      ...r,
      target_user_ids: r.target_user_ids ?? null,
      target_emails: r.target_emails ?? [],
      starts_at: r.starts_at ? r.starts_at.toISOString() : null,
      ends_at: r.ends_at ? r.ends_at.toISOString() : null,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    })) as NoticeRow[];
  });

// =====================================================================
// Admin: Upsert (create or update)
// =====================================================================
const upsertNoticeSchema = z.object({
  token: z.string().min(1),
  id: z.string().uuid().optional().nullable(),
  type: z.enum(["banner", "popup"]),
  priority: z.enum(["info", "warning", "critical"]),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(4000).default(""),
  active: z.boolean().default(true),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  target_emails: z.array(z.string().trim().email()).max(5000).optional().nullable(),
});

export const adminUpsertNoticeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertNoticeSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; id: string; matched_users: number }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");

    // Resolve emails -> user_ids (NULL when empty = broadcast to all)
    let target_user_ids: string[] | null = null;
    const emails = (data.target_emails ?? []).map((e) => e.toLowerCase().trim()).filter(Boolean);
    if (emails.length) {
      const rows = await sql<any[]>`SELECT id FROM users WHERE lower(email::text) = ANY(${emails})`;
      target_user_ids = rows.map((r) => r.id);
      if (!target_user_ids.length) {
        throw new Error("No matching users found for the provided emails");
      }
    }

    let id: string;
    if (data.id) {
      const [row] = await sql<any[]>`
        UPDATE notices SET
          type = ${data.type}::notice_type,
          priority = ${data.priority}::notice_priority,
          title = ${data.title}, body = ${data.body},
          active = ${data.active},
          starts_at = ${data.starts_at ?? null},
          ends_at = ${data.ends_at ?? null},
          target_user_ids = ${target_user_ids as any},
          updated_at = now()
        WHERE id = ${data.id}
        RETURNING id
      `;
      if (!row) throw new Error("Notice not found");
      id = row.id;
    } else {
      const [row] = await sql<any[]>`
        INSERT INTO notices (type, priority, title, body, active, starts_at, ends_at, target_user_ids, created_by)
        VALUES (${data.type}::notice_type, ${data.priority}::notice_priority,
                ${data.title}, ${data.body}, ${data.active},
                ${data.starts_at ?? null}, ${data.ends_at ?? null},
                ${target_user_ids as any}, ${admin.sub})
        RETURNING id
      `;
      id = row.id;
    }
    await audit(admin.sub, data.id ? "notice.update" : "notice.create", { type: "notice", id }, { title: data.title, type: data.type, targets: target_user_ids?.length ?? "all" });
    return { ok: true as const, id, matched_users: target_user_ids?.length ?? 0 };
  });

// =====================================================================
// Admin: Delete notice
// =====================================================================
export const adminDeleteNoticeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");
    await sql`DELETE FROM notices WHERE id = ${data.id}`;
    await audit(admin.sub, "notice.delete", { type: "notice", id: data.id });
    return { ok: true as const };
  });

// =====================================================================
// Public (authenticated): active notices for current user
// =====================================================================
export const listActiveNoticesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<NoticeRow[]> => {
    // requireAuth already enforces maintenance + ban; we just need a valid session
    const { requireAuth } = await import("./auth-guard.server");
    await requireAuth(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT id, type::text AS type, priority::text AS priority,
             title, body, active, starts_at, ends_at, created_at, updated_at
      FROM notices
      WHERE active = true
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at   IS NULL OR ends_at   >= now())
      ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT 20
    `;
    return rows.map((r) => ({
      ...r,
      starts_at: r.starts_at ? r.starts_at.toISOString() : null,
      ends_at: r.ends_at ? r.ends_at.toISOString() : null,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    })) as NoticeRow[];
  });

// =====================================================================
// Admin: Audit log list
// =====================================================================
export const adminListAuditFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    search: z.string().optional(),
    limit: z.number().int().min(10).max(500).optional(),
  }).parse(d))
  .handler(async ({ data }): Promise<AuditRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const q = `%${(data.search ?? "").trim().toLowerCase()}%`;
    const limit = data.limit ?? 100;
    const rows = await sql<any[]>`
      SELECT a.id, a.actor_id, u.email::text AS actor_email,
             a.action, a.target_type, a.target_id, a.meta, a.created_at
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.actor_id
      WHERE (${data.search ?? ""} = ''
             OR lower(a.action) LIKE ${q}
             OR lower(COALESCE(u.email::text,'')) LIKE ${q}
             OR lower(COALESCE(a.target_id::text,'')) LIKE ${q})
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      ...r,
      created_at: r.created_at.toISOString(),
    })) as AuditRow[];
  });
