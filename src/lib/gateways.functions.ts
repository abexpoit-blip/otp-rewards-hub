/**
 * Payment gateway server functions.
 * - Public (authenticated): list enabled gateways for withdrawal page
 * - Admin: CRUD
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type GatewayRow = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  min_amount: string;
  max_amount: string;
  fee_percent: string;
  fee_flat: string;
  auto_approve_under: string | null;
  instructions: string | null;
  sort_order: number;
  updated_at: string;
};

const tokenSchema = z.object({ token: z.string().min(1) });

function mapRow(r: any): GatewayRow {
  return {
    id: r.id, code: r.code, name: r.name, enabled: r.enabled,
    min_amount: String(r.min_amount), max_amount: String(r.max_amount),
    fee_percent: String(r.fee_percent), fee_flat: String(r.fee_flat),
    auto_approve_under: r.auto_approve_under == null ? null : String(r.auto_approve_under),
    instructions: r.instructions, sort_order: r.sort_order,
    updated_at: r.updated_at.toISOString(),
  };
}

// Public: authenticated users see enabled gateways
export const listEnabledGatewaysFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<GatewayRow[]> => {
    const { requireAuth } = await import("./auth-guard.server");
    await requireAuth(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT id, code, name, enabled, min_amount, max_amount,
             fee_percent, fee_flat, auto_approve_under, instructions,
             sort_order, updated_at
      FROM payment_gateways WHERE enabled = true
      ORDER BY sort_order ASC, name ASC
    `;
    return rows.map(mapRow);
  });

// Admin: list all
export const adminListGatewaysFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<GatewayRow[]> => {
    const { requireAdmin } = await import("./admin-guard.server");
    await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const rows = await sql<any[]>`
      SELECT id, code, name, enabled, min_amount, max_amount,
             fee_percent, fee_flat, auto_approve_under, instructions,
             sort_order, updated_at
      FROM payment_gateways ORDER BY sort_order ASC, name ASC
    `;
    return rows.map(mapRow);
  });

const upsertSchema = z.object({
  token: z.string().min(1),
  id: z.string().uuid().optional().nullable(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  min_amount: z.number().min(0).max(1_000_000),
  max_amount: z.number().min(0).max(10_000_000),
  fee_percent: z.number().min(0).max(50),
  fee_flat: z.number().min(0).max(10_000),
  auto_approve_under: z.number().min(0).max(1_000_000).optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
  sort_order: z.number().int().min(0).max(10_000).default(100),
});

export const adminUpsertGatewayFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; id: string }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");
    let id: string;
    if (data.id) {
      const [row] = await sql<any[]>`
        UPDATE payment_gateways SET
          code = ${data.code}, name = ${data.name}, enabled = ${data.enabled},
          min_amount = ${data.min_amount}, max_amount = ${data.max_amount},
          fee_percent = ${data.fee_percent}, fee_flat = ${data.fee_flat},
          auto_approve_under = ${data.auto_approve_under ?? null},
          instructions = ${data.instructions ?? null},
          sort_order = ${data.sort_order}
        WHERE id = ${data.id} RETURNING id
      `;
      if (!row) throw new Error("Gateway not found");
      id = row.id;
    } else {
      const [row] = await sql<any[]>`
        INSERT INTO payment_gateways (code, name, enabled, min_amount, max_amount,
          fee_percent, fee_flat, auto_approve_under, instructions, sort_order)
        VALUES (${data.code}, ${data.name}, ${data.enabled},
          ${data.min_amount}, ${data.max_amount},
          ${data.fee_percent}, ${data.fee_flat},
          ${data.auto_approve_under ?? null}, ${data.instructions ?? null},
          ${data.sort_order})
        RETURNING id
      `;
      id = row.id;
    }
    await audit(admin.sub, data.id ? "gateway.update" : "gateway.create", { type: "gateway", id }, { code: data.code });
    return { ok: true as const, id };
  });

export const adminDeleteGatewayFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");
    await sql`DELETE FROM payment_gateways WHERE id = ${data.id}`;
    await audit(admin.sub, "gateway.delete", { type: "gateway", id: data.id });
    return { ok: true as const };
  });

export const adminToggleGatewayFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1), id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("./admin-guard.server");
    const admin = await requireAdmin(data.token);
    const { sql } = await import("./db.server");
    const { audit } = await import("./audit.server");
    await sql`UPDATE payment_gateways SET enabled = ${data.enabled} WHERE id = ${data.id}`;
    await audit(admin.sub, "gateway.toggle", { type: "gateway", id: data.id }, { enabled: data.enabled });
    return { ok: true as const };
  });
