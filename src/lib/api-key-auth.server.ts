/**
 * API key authentication for public REST endpoints under /api/v1/*.
 *
 * Bots send: Authorization: Bearer nx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * We sha256-hash the raw key, look it up in api_keys, and return the owner.
 * Each successful auth scopes ALL data access to that user_id ONLY —
 * the bot cannot read/modify another user's data.
 */
import { createHash } from "node:crypto";
import { sql } from "./db.server";

export type ApiAuth = { userId: string; keyId: string };

export async function requireApiKey(req: Request): Promise<ApiAuth> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(nx_[A-Za-z0-9_-]{10,})$/);
  if (!m) throw apiError(401, "Missing or malformed Authorization header. Expected: Bearer nx_...");
  const raw = m[1];
  const hash = createHash("sha256").update(raw).digest("hex");

  const [row] = await sql<any[]>`
    SELECT k.id AS key_id, k.user_id, k.revoked_at, u.status::text AS user_status,
           EXISTS(SELECT 1 FROM user_roles ur
                  WHERE ur.user_id = k.user_id AND ur.role IN ('admin','agent')) AS is_privileged
    FROM api_keys k
    JOIN users u ON u.id = k.user_id
    WHERE k.key_hash = ${hash}
    LIMIT 1
  `;
  if (!row) throw apiError(401, "Invalid API key");
  if (row.revoked_at) throw apiError(401, "API key revoked");
  if (row.user_status === "blocked") throw apiError(403, "Account blocked");
  if (row.user_status === "pending") throw apiError(403, "Account pending approval");
  if (row.is_privileged) throw apiError(403, "API access is available to user accounts only");


  // best-effort last_used_at (don't await for latency)
  void sql`UPDATE api_keys SET last_used_at = now() WHERE id = ${row.key_id}`.catch(() => {});

  return { userId: row.user_id, keyId: row.key_id };
}

export function apiError(status: number, message: string): Error & { __apiStatus: number } {
  const e = new Error(message) as Error & { __apiStatus: number };
  e.__apiStatus = status;
  return e;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function errorResponse(e: unknown): Response {
  const status = (e as any)?.__apiStatus || 500;
  const message = (e as any)?.message || "Internal error";
  return jsonResponse({ ok: false, error: message }, status);
}
