/**
 * GET /api/v1/numbers/:id — allocation status + every OTP received for it.
 * Bots typically poll this every 3-5 seconds until status === 'success'.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/numbers/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { requireApiKey, jsonResponse, errorResponse, apiError } =
          await import("@/lib/api-key-auth.server");
        try {
          const auth = await requireApiKey(request);
          const { sql } = await import("@/lib/db.server");
          const { triggerPollerIngest } = await import("@/lib/poller.server");
          await triggerPollerIngest("api-number-status");
          const [a] = await sql<any[]>`
            SELECT id, full_number, national_number, no_plus_number, country, operator,
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
          return jsonResponse({
            ok: true,
            id: a.id, number: a.full_number,
            full_number: a.full_number, national_number: a.national_number, no_plus_number: a.no_plus_number,
            country: a.country, operator: a.operator, status: a.status,
            payout: Number(a.payout_amount),
            created_at: a.created_at.toISOString(),
            completed_at: a.completed_at ? a.completed_at.toISOString() : null,
            expires_at: a.expires_at ? a.expires_at.toISOString() : null,
            otps: otps.map((o) => ({
              id: o.id, sender: o.sender, body: o.body,
              received_at: o.received_at.toISOString(),
            })),
          });
        } catch (e) { return errorResponse(e); }
      },
    },
  },
});
