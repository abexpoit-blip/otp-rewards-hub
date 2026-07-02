/**
 * GET /api/v1/numbers/:id — allocation status + every OTP received for it.
 * Bots typically poll this every 3-5 seconds until status === 'success'.
 *
 * Auth: `Authorization: Bearer nx_...` (user-role API key only).
 *
 * Response fields (top-level):
 *   id, number, full_number, national_number, no_plus_number,
 *   country, operator, status, service | access | sid,
 *   payout, created_at, completed_at, expires_at
 *
 * `otps[]` items (always present, never undefined):
 *   id          - OTP UUID
 *   sender      - SMS sender/originator ("" if unknown)
 *   body        - full SMS text (aliases: text, full_text, console)
 *   text        - alias of body
 *   full_text   - alias of body
 *   console     - alias of body (bot-friendly)
 *   received_at - ISO-8601 UTC
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/numbers/$id")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/api-key-auth.server");
        return corsPreflight();
      },
      GET: async ({ request, params }) => {
        const { requireApiKey, jsonResponse, errorResponse, apiError } =
          await import("@/lib/api-key-auth.server");
        try {
          const auth = await requireApiKey(request);
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
            throw apiError(400, "Invalid allocation id");
          }
          const { sql } = await import("@/lib/db.server");
          const { triggerPollerIngest } = await import("@/lib/poller.server");
          await triggerPollerIngest("api-number-status");
          const [a] = await sql<any[]>`
            SELECT id, sid, full_number, national_number, no_plus_number, country, operator,
                   status::text AS status, payout_amount::text AS payout_amount,
                   created_at, completed_at, expires_at
            FROM allocations
            WHERE id = ${params.id}::uuid AND user_id = ${auth.userId}
          `;
          if (!a) throw apiError(404, "Allocation not found");
          const otps = await sql<any[]>`
            SELECT id, number, sender, body, received_at
            FROM otp_messages
            WHERE allocation_id = ${params.id}::uuid AND user_id = ${auth.userId}
            ORDER BY received_at ASC
          `;
          const service = a.sid ?? null;
          const payout = a.payout_amount != null && Number.isFinite(Number(a.payout_amount)) ? Number(a.payout_amount) : 0;
          return jsonResponse({
            ok: true,
            id: a.id,
            number: a.full_number,
            full_number: a.full_number,
            national_number: a.national_number,
            no_plus_number: a.no_plus_number,
            country: a.country ?? null,
            operator: a.operator ?? null,
            status: a.status,
            service,
            access: service,
            sid: service,
            payout,
            created_at: a.created_at.toISOString(),
            completed_at: a.completed_at ? a.completed_at.toISOString() : null,
            expires_at: a.expires_at ? a.expires_at.toISOString() : null,
            otps: otps.map((o) => {
              const body = typeof o.body === "string" ? o.body : "";
              return {
                id: o.id,
                sender: o.sender ?? "",
                body,
                text: body,
                full_text: body,
                console: body,
                received_at: o.received_at.toISOString(),
              };
            }),
          });
        } catch (e) { return errorResponse(e); }
      },
    },
  },
});
