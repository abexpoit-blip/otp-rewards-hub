/**
 * POST /api/v1/numbers — allocate a fresh phone number for the bot.
 *   body: { "range": "<rid>", "sid"?: "<service id>",
 *           "national"?: bool, "no_plus"?: bool }
 *
 * GET  /api/v1/numbers?status=pending|success|failed|expired&limit=50
 *   list this user's recent allocations.
 *
 * Auth: `Authorization: Bearer nx_...` (user-role API key only).
 *
 * Response item fields (always present):
 *   id              - allocation UUID
 *   number          - display number (E.164 by default)
 *   full_number     - E.164 form  (+8801...)
 *   national_number - national form (01...)
 *   no_plus_number  - digits only  (8801...)
 *   country         - ISO country code (nullable)
 *   operator        - carrier/operator (nullable)
 *   status          - pending | success | failed | expired
 *   service         - service/app slug (alias: `access`, `sid`)
 *   access          - alias of `service`
 *   sid             - alias of `service`
 *   payout          - credited BDT amount when status = success (number, 0 otherwise)
 *   created_at      - ISO-8601 UTC
 *   completed_at    - ISO-8601 UTC or null
 *   expires_at      - ISO-8601 UTC or null
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const allocBody = z.object({
  range: z.string().trim().min(1),
  sid: z.string().trim().optional().nullable(),
  national: z.boolean().optional(),
  no_plus: z.boolean().optional(),
});

const statusEnum = new Set(["pending", "success", "failed", "expired"]);

export const Route = createFileRoute("/api/v1/numbers")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/api-key-auth.server");
        return corsPreflight();
      },
      POST: async ({ request }) => {
        const { requireApiKey, jsonResponse, errorResponse, apiError } =
          await import("@/lib/api-key-auth.server");
        try {
          const auth = await requireApiKey(request);
          const raw = await request.json().catch(() => ({}));
          const parsed = allocBody.safeParse(raw);
          if (!parsed.success) throw apiError(400, "Invalid body: " + parsed.error.issues.map(i => i.message).join(", "));
          const body = parsed.data;
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
            RETURNING id, sid, full_number, national_number, no_plus_number, country, operator, status, created_at, expires_at
          `;
          ensurePollerStarted();
          const display = body.no_plus ? row.no_plus_number : body.national ? row.national_number : row.full_number;
          const service = row.sid ?? null;
          return jsonResponse({
            ok: true,
            id: row.id,
            number: display,
            full_number: row.full_number,
            national_number: row.national_number,
            no_plus_number: row.no_plus_number,
            country: row.country ?? null,
            operator: row.operator ?? null,
            status: row.status,
            service,
            access: service,
            sid: service,
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
          const statusRaw = url.searchParams.get("status");
          const status = statusRaw && statusEnum.has(statusRaw) ? statusRaw : null;
          const limitRaw = Number(url.searchParams.get("limit") || 50);
          const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;
          const { sql } = await import("@/lib/db.server");
          const { triggerPollerIngest } = await import("@/lib/poller.server");
          await triggerPollerIngest("api-numbers-list");
          const rows = await sql<any[]>`
            SELECT id, sid, full_number, national_number, no_plus_number, country, operator,
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
            items: rows.map((r) => {
              const service = r.sid ?? null;
              const payout = r.payout_amount != null && Number.isFinite(Number(r.payout_amount)) ? Number(r.payout_amount) : 0;
              return {
                id: r.id,
                number: r.full_number,
                full_number: r.full_number,
                national_number: r.national_number,
                no_plus_number: r.no_plus_number,
                country: r.country ?? null,
                operator: r.operator ?? null,
                status: r.status,
                service,
                access: service,
                sid: service,
                payout,
                created_at: r.created_at.toISOString(),
                completed_at: r.completed_at ? r.completed_at.toISOString() : null,
                expires_at: r.expires_at ? r.expires_at.toISOString() : null,
              };
            }),
          });
        } catch (e) { return errorResponse(e); }
      },
    },
  },
});
