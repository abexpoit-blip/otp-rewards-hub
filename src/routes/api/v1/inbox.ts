/**
 * GET /api/v1/inbox?limit=50&since=<ISO>
 *
 * Auth: `Authorization: Bearer nx_...` (user-role API key only).
 * Returns recent OTP messages for the bot's account.
 *
 * Response item fields (always present, never undefined):
 *   id            - OTP message UUID
 *   allocation_id - parent number allocation UUID
 *   number        - the phone number the OTP was sent to (E.164)
 *   sender        - SMS sender/originator (e.g. "WhatsApp", "+123..."); "" if unknown
 *   service       - service/app slug used at allocation time (alias: `access`, `sid`)
 *   access        - same as `service` (bot-friendly naming)
 *   sid           - same as `service` (raw upstream field name)
 *   body          - full SMS text (aliases: `text`, `full_text`, `console`)
 *   text          - alias of `body`
 *   full_text     - alias of `body`
 *   console       - alias of `body` (bot-friendly naming)
 *   country       - ISO country code (may be null if upstream omits)
 *   operator      - carrier/operator (may be null)
 *   payout        - credited amount for this OTP in BDT (number, 0 if none)
 *   received_at   - ISO-8601 UTC timestamp
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/inbox")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/api-key-auth.server");
        return corsPreflight();
      },
      GET: async ({ request }) => {
        const { requireApiKey, jsonResponse, errorResponse } = await import("@/lib/api-key-auth.server");
        try {
          const auth = await requireApiKey(request);
          const url = new URL(request.url);
          const limitRaw = Number(url.searchParams.get("limit") || 50);
          const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;
          const sinceParam = url.searchParams.get("since");
          const since = sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? sinceParam : null;
          const { sql } = await import("@/lib/db.server");
          const { triggerPollerIngest } = await import("@/lib/poller.server");
          await triggerPollerIngest("api-inbox");
          const rows = await sql<any[]>`
            SELECT om.id, om.allocation_id, om.number, om.sender, om.body, om.country, om.received_at,
                   a.payout_amount::text AS payout, a.sid AS service, a.operator
            FROM otp_messages om
            LEFT JOIN allocations a ON a.id = om.allocation_id
            WHERE om.user_id = ${auth.userId}
              AND (${since}::timestamptz IS NULL OR om.received_at > ${since}::timestamptz)
            ORDER BY om.received_at DESC LIMIT ${limit}
          `;
          return jsonResponse({
            ok: true,
            count: rows.length,
            items: rows.map((r) => {
              const body = typeof r.body === "string" ? r.body : "";
              const service = r.service ?? null;
              return {
                id: r.id,
                allocation_id: r.allocation_id,
                number: r.number ?? "",
                sender: r.sender ?? "",
                service,
                access: service,
                sid: service,
                body,
                text: body,
                full_text: body,
                console: body,
                country: r.country ?? null,
                operator: r.operator ?? null,
                payout: r.payout != null && Number.isFinite(Number(r.payout)) ? Number(r.payout) : 0,
                received_at: r.received_at.toISOString(),
              };
            }),
          });
        } catch (e) { return errorResponse(e); }
      },
    },
  },
});
