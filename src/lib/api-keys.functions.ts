import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ApiKeyRow = {
  id: string;
  key_prefix: string;
  label: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const tokenSchema = z.object({ token: z.string().min(1) });

export const listApiKeysFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<ApiKeyRow[]> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = requireAuth(data.token);
    const rows = await sql`
      SELECT id, key_prefix, label, last_used_at, revoked_at, created_at
      FROM api_keys WHERE user_id = ${auth.sub}
      ORDER BY created_at DESC
    `;
    return rows.map((r: any) => ({
      id: r.id, key_prefix: r.key_prefix, label: r.label,
      last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
      revoked_at: r.revoked_at ? r.revoked_at.toISOString() : null,
      created_at: r.created_at.toISOString(),
    }));
  });

const createSchema = z.object({
  token: z.string().min(1),
  label: z.string().trim().max(80).optional().nullable(),
});

export const createApiKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; key: string; prefix: string }> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = requireAuth(data.token);
    const crypto = await import("node:crypto");
    const raw = "nx_" + crypto.randomBytes(28).toString("base64url");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const prefix = raw.slice(0, 11); // nx_ + 8 chars
    await sql`
      INSERT INTO api_keys (user_id, key_hash, key_prefix, label)
      VALUES (${auth.sub}, ${hash}, ${prefix}, ${data.label ?? null})
    `;
    return { ok: true, key: raw, prefix };
  });

const revokeSchema = z.object({
  token: z.string().min(1),
  id: z.string().uuid(),
});

export const revokeApiKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => revokeSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = requireAuth(data.token);
    await sql`
      UPDATE api_keys SET revoked_at = now()
      WHERE id = ${data.id} AND user_id = ${auth.sub} AND revoked_at IS NULL
    `;
    return { ok: true };
  });
