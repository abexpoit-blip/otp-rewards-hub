/**
 * Support inbox — Agent <-> Admin only (no user access).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(1) });

// =====================================================================
// Agent side
// =====================================================================
export const agentListThreadsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT id, subject, status, last_msg_at, unread_agent, created_at
      FROM support_threads
      WHERE agent_id = ${auth.sub}
      ORDER BY last_msg_at DESC LIMIT 100
    `;
    return rows.map((r) => ({
      ...r,
      last_msg_at: r.last_msg_at.toISOString(),
      created_at: r.created_at.toISOString(),
    }));
  });

export const agentCreateThreadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    subject: z.string().trim().min(2).max(200),
    body: z.string().trim().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const { getSetting } = await import("./settings.server");
    if (!(await getSetting<boolean>("support_enabled", true))) {
      throw new Error("Support service is currently disabled by admin.");
    }
    return await sql.begin(async (tx) => {
      const [t] = await tx<any[]>`
        INSERT INTO support_threads (agent_id, subject, unread_admin)
        VALUES (${auth.sub}, ${data.subject}, 1)
        RETURNING id
      `;
      await tx`
        INSERT INTO support_messages (thread_id, sender_id, sender_role, body)
        VALUES (${t.id}, ${auth.sub}, 'agent', ${data.body})
      `;
      return { ok: true as const, id: t.id };
    });
  });

export const agentSendMessageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    thread_id: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireAgent } = await import("./agent-guard.server");
    const auth = await requireAgent(data.token);
    const { sql } = await import("./db.server");
    const { getSetting } = await import("./settings.server");
    if (!(await getSetting<boolean>("support_enabled", true))) {
      throw new Error("Support service is currently disabled by admin.");
    }
    return await sql.begin(async (tx) => {
      const [t] = await tx<any[]>`SELECT agent_id, status FROM support_threads WHERE id = ${data.thread_id} FOR UPDATE`;
      if (!t) throw new Error("Thread not found");
      if (t.agent_id !== auth.sub) throw new Error("Not your thread");
      if (t.status === "closed") throw new Error("Thread is closed");
      await tx`
        INSERT INTO support_messages (thread_id, sender_id, sender_role, body)
        VALUES (${data.thread_id}, ${auth.sub}, 'agent', ${data.body})
      `;
      await tx`
        UPDATE support_threads
        SET last_msg_at = now(), unread_admin = unread_admin + 1, unread_agent = 0
        WHERE id = ${data.thread_id}
      `;
      return { ok: true as const };
    });
  });

// Shared (agent + admin): get a thread + messages
export const supportGetThreadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const { isAdmin } = await import("./agent-guard.server");
    const auth = await requireAuth(data.token);
    const admin = await isAdmin(auth.sub);
    const isAgent = auth.roles?.includes("agent") || admin;
    if (!isAgent) throw new Error("Forbidden");

    const { sql } = await import("./db.server");
    const [t] = await sql<any[]>`
      SELECT t.id, t.subject, t.status, t.agent_id, t.created_at, t.last_msg_at,
             u.email::text AS agent_email, u.name AS agent_name
      FROM support_threads t
      JOIN users u ON u.id = t.agent_id
      WHERE t.id = ${data.thread_id}
    `;
    if (!t) throw new Error("Thread not found");
    if (!admin && t.agent_id !== auth.sub) throw new Error("Not your thread");

    // Mark read for current side
    if (admin) {
      await sql`UPDATE support_threads SET unread_admin = 0 WHERE id = ${data.thread_id}`;
    } else {
      await sql`UPDATE support_threads SET unread_agent = 0 WHERE id = ${data.thread_id}`;
    }

    const msgs = await sql<any[]>`
      SELECT id, sender_role, body, created_at
      FROM support_messages WHERE thread_id = ${data.thread_id}
      ORDER BY created_at ASC
    `;
    return {
      thread: {
        id: t.id, subject: t.subject, status: t.status,
        agent_email: t.agent_email, agent_name: t.agent_name,
        created_at: t.created_at.toISOString(),
        last_msg_at: t.last_msg_at.toISOString(),
      },
      messages: msgs.map((m) => ({ ...m, created_at: m.created_at.toISOString() })),
    };
  });

// =====================================================================
// Admin side
// =====================================================================
export const adminListSupportThreadsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT t.id, t.subject, t.status, t.last_msg_at, t.unread_admin, t.created_at,
             u.email::text AS agent_email, u.name AS agent_name
      FROM support_threads t
      JOIN users u ON u.id = t.agent_id
      ORDER BY (t.unread_admin > 0) DESC, t.last_msg_at DESC
      LIMIT 200
    `;
    return rows.map((r) => ({
      ...r,
      last_msg_at: r.last_msg_at.toISOString(),
      created_at: r.created_at.toISOString(),
    }));
  });

export const adminReplyThreadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(1),
    thread_id: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-guard.server");
    const auth = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    return await sql.begin(async (tx) => {
      const [t] = await tx<any[]>`SELECT id, status FROM support_threads WHERE id = ${data.thread_id} FOR UPDATE`;
      if (!t) throw new Error("Thread not found");
      if (t.status === "closed") throw new Error("Thread is closed");
      await tx`
        INSERT INTO support_messages (thread_id, sender_id, sender_role, body)
        VALUES (${data.thread_id}, ${auth.sub}, 'admin', ${data.body})
      `;
      await tx`
        UPDATE support_threads
        SET last_msg_at = now(), unread_agent = unread_agent + 1, unread_admin = 0
        WHERE id = ${data.thread_id}
      `;
      return { ok: true as const };
    });
  });

export const adminCloseThreadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), thread_id: z.string().uuid(), close: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    await sql`UPDATE support_threads SET status = ${data.close ? "closed" : "open"} WHERE id = ${data.thread_id}`;
    return { ok: true as const };
  });
