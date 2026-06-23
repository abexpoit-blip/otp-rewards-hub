/**
 * GET /api/v1/inbox?limit=50&since=<ISO>
 * Returns recent OTP messages for the bot's account. Useful for unified inbox sync.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/inbox")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiKey, jsonResponse, errorResponse } = await import("@/lib/api-key-auth.server");
        try {
          const auth = await requireApiKey(request);
          const url = new URL(request.url);
          const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
          const since = url.searchParams.get("since");
          const { sql } = await import("@/lib/db.server");
          const { triggerPollerIngest } = await import("@/lib/poller.server");
          await triggerPollerIngest("api-inbox");
          const rows = await sql<any[]>`
            SELECT om.id, om.allocation_id, om.number, om.sender, om.body, om.country, om.received_at,
                   a.payout_amount::text AS payout
            FROM otp_messages om
            LEFT JOIN allocations a ON a.id = om.allocation_id
            WHERE om.user_id = ${auth.userId}
              AND (${since}::timestamptz IS NULL OR om.received_at > ${since}::timestamptz)
            ORDER BY om.received_at DESC LIMIT ${limit}
          `;
          return jsonResponse({
            ok: true, count: rows.length,
            items: rows.map((r) => ({
              id: r.id, allocation_id: r.allocation_id,
              number: r.number, sender: r.sender, body: r.body, country: r.country,
              payout: r.payout != null ? Number(r.payout) : 0,
              received_at: r.received_at.toISOString(),
            })),
          });
        } catch (e) { return errorResponse(e); }
      },
    },
  },
});
