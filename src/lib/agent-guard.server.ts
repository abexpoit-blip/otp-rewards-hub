/**
 * Agent-only guard. Admins also pass (they have an agent role auto-attached).
 */
import { requireAuth } from "./auth-guard.server";
import type { JwtPayload } from "./jwt.server";

export async function requireAgent(token: string | undefined | null): Promise<JwtPayload> {
  const auth = await requireAuth(token);
  const { sql } = await import("./db.server");
  const [r] = await sql<{ ok: boolean }[]>`
    SELECT (has_role(${auth.sub}::uuid, 'agent') OR has_role(${auth.sub}::uuid, 'admin')) AS ok
  `;
  if (!r?.ok) {
    const err: any = new Error("Forbidden: agents only");
    err.status = 403;
    throw err;
  }
  return auth;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { sql } = await import("./db.server");
  const [r] = await sql<{ ok: boolean }[]>`SELECT has_role(${userId}::uuid, 'admin') AS ok`;
  return !!r?.ok;
}
