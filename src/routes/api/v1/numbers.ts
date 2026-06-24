/**
 * POST /api/v1/numbers — allocate a fresh phone number for the bot
 *   body: { "range": "<rid>", "sid"?: "<service id>",
 *           "national"?: bool, "no_plus"?: bool }
 *
 * GET  /api/v1/numbers?status=pending|success|failed|expired&limit=50
 *   list this user's recent allocations
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const allocBody = z.object({
  range: z.string().trim().min(1),
  sid: z.string().trim().optional().nullable(),
  national: z.boolean().optional(),
  no_plus: z.boolean().optional(),
});

export const Route = createFileRoute("/api/v1/numbers")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireApiKey, jsonResponse, errorResponse, apiError } =
          await import("@/lib/api-key-auth.server");
        try {
          const auth = await requireApiKey(request);
          const body = allocBody.parse(await request.json().catch(() => ({})));
          const { sql } = await import("@/lib/db.server");
          const { stexGetNum } = await import("@/lib/stex.server");
          const { ensurePollerStarted } = await import("@/lib/poller.server");

          const r = await stexGetNum(body.range);
          if (r.meta.code === 2946 || !r.data) throw apiError(409, "Out of stock for this range");
          if (r.meta.code !== 200 || !r.data) throw apiError(502, r.message || "Upstream allocation failed");
          const n = r.data;
          const flags = { national: !!body.national, no_plus: !!body.no_plus };
          const [row] = await sql<any[]>`
            INSERT INTO allocations (user_id, rid, sid, full_number, national_number, no_plus_number, country, operator, status, stex_response, flags)
            VALUES (${auth.userId}, ${body.range}, ${body.sid ?? null}, ${n.full_number}, ${n.national_number}, ${n.no_plus_number}, ${n.country}, ${n.operator}, 'pending', ${JSON.stringify(r)}::jsonb, ${JSON.stringify(flags)}::jsonb)
            RETURNING id, full_number, national_number, no_plus_number, country, operator, status, created_at, expires_at
          `;
          ensurePollerStarted();
          const display = body.no_plus ? row.no_plus_number : body.national ? row.national_number : row.full_number;
          return jsonResponse({
            ok: true,
            id: row.id,
            number: display,
            full_number: row.full_number,
            national_number: row.national_number,
            no_plus_number: row.no_plus_number,
            country: row.country,
            operator: row.operator,
            status: row.status,
            created_at: row.created_at.toISOString(),
            expires_at: row.expires_at ? row.expires_at.toISOString() : null,
          }, 201);
        } catch (e) { return errorResponse(e); }
      },

      GET: async ({ request }) => {
        const { requireApiKey, jsonResponse, errorResponse } = await import("@/lib/api-key-auth.server");
        try {
          const auth = await requireApiKey(request);
          const url = new URL(request.url);
          const status = url.searchParams.get("status");
          const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
          const { sql } = await import("@/lib/db.server");
          const { triggerPollerIngest } = await import("@/lib/poller.server");
          await triggerPollerIngest("api-numbers-list");
          const rows = await sql<any[]>`
            SELECT id, full_number, national_number, no_plus_number, country, operator,
                   status::text AS status, payout_amount::text AS payout_amount,
                   created_at, completed_at, expires_at
            FROM allocations
            WHERE user_id = ${auth.userId}
              AND (${status}::text IS NULL OR status::text = ${status}::text)
            ORDER BY created_at DESC LIMIT ${limit}
          `;
          return jsonResponse({
            ok: true,
            count: rows.length,
            items: rows.map((r) => ({
              id: r.id, number: r.full_number,
              full_number: r.full_number, national_number: r.national_number, no_plus_number: r.no_plus_number,
              country: r.country, operator: r.operator, status: r.status,
              payout: Number(r.payout_amount),
              created_at: r.created_at.toISOString(),
              completed_at: r.completed_at ? r.completed_at.toISOString() : null,
              expires_at: r.expires_at ? r.expires_at.toISOString() : null,
            })),
          });
        } catch (e) { return errorResponse(e); }
      },
    },
  },
});
