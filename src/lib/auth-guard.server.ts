/**
 * Server-side auth helper for createServerFn handlers.
 * Token client থেকে data payload এ আসে; এখানে verify + active-user check করি।
 *
 * Sprint 1: makes requireAuth async — also enforces:
 *  - users.status (blocked → 403)
 *  - users.banned_until > now → 403 with reason
 *  - JWT iat < users.tokens_invalidated_at → 401 (force-logout)
 *  - app_settings.maintenance_mode → 503 for non-admins
 */
import { verifyToken, type JwtPayload } from "./jwt.server";

export async function requireAuth(token: string | undefined | null): Promise<JwtPayload> {
  if (!token) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  let payload: JwtPayload & { iat?: number };
  try {
    payload = verifyToken(token) as JwtPayload & { iat?: number };
  } catch {
    const err: any = new Error("Invalid or expired session");
    err.status = 401;
    throw err;
  }

  const { sql } = await import("./db.server");
  const [u] = await sql<any[]>`
    SELECT status::text AS status, banned_until, ban_reason,
           EXTRACT(EPOCH FROM tokens_invalidated_at)::bigint AS inv_epoch
    FROM users WHERE id = ${payload.sub}
  `;
  if (!u) {
    const err: any = new Error("Account not found");
    err.status = 401;
    throw err;
  }

  // Force-logout: token issued before invalidation marker
  if (payload.iat && u.inv_epoch && payload.iat < Number(u.inv_epoch)) {
    const err: any = new Error("Session revoked — please log in again");
    err.status = 401;
    throw err;
  }

  // Blocked / banned
  if (u.status === "blocked") {
    const err: any = new Error(u.ban_reason ? `Account blocked: ${u.ban_reason}` : "Account blocked");
    err.status = 403;
    throw err;
  }
  if (u.banned_until && new Date(u.banned_until).getTime() > Date.now()) {
    const until = new Date(u.banned_until).toISOString();
    const err: any = new Error(`Account suspended until ${until}${u.ban_reason ? ` — ${u.ban_reason}` : ""}`);
    err.status = 403;
    throw err;
  }

  // Maintenance mode: only admins bypass
  const [m] = await sql<any[]>`SELECT value FROM app_settings WHERE key = 'maintenance_mode'`;
  if (m && (m.value === true || m.value === "true")) {
    const isAdmin = payload.roles?.includes("admin");
    if (!isAdmin) {
      const [msg] = await sql<any[]>`SELECT value FROM app_settings WHERE key = 'maintenance_message'`;
      const text = typeof msg?.value === "string" ? msg.value : "System is under maintenance.";
      const err: any = new Error(text);
      err.status = 503;
      throw err;
    }
  }

  return payload;
}

export function requireRole(payload: JwtPayload, role: string): JwtPayload {
  if (!payload.roles?.includes(role)) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return payload;
}
