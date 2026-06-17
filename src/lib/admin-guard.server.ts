/**
 * Admin-only guard. Verifies JWT + checks has_role(user_id, 'admin').
 */
import { requireAuth, type JwtPayload } from "./auth-guard.server";

export async function requireAdmin(token: string | undefined | null): Promise<JwtPayload> {
  const auth = requireAuth(token);
  const { sql } = await import("./db.server");
  const [r] = await sql<{ ok: boolean }[]>`
    SELECT has_role(${auth.sub}::uuid, 'admin') AS ok
  `;
  if (!r?.ok) {
    const err: any = new Error("Forbidden: admin only");
    err.status = 403;
    throw err;
  }
  return auth;
}
