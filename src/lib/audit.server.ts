/**
 * Audit log helper — fire-and-forget logging for admin actions.
 */
import { sql } from "./db.server";

export async function audit(
  actorId: string,
  action: string,
  target?: { type?: string; id?: string },
  meta: Record<string, any> = {},
): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_log (actor_id, action, target_type, target_id, meta)
      VALUES (${actorId}, ${action}, ${target?.type ?? null}, ${target?.id ?? null}, ${JSON.stringify(meta)}::jsonb)
    `;
  } catch (e) {
    console.error("[audit] failed to write", e);
  }
}
