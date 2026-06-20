/**
 * STEX OTP webhook — instant delivery endpoint.
 *
 * STEX (or any compatible upstream) POSTs here when an OTP arrives.
 * We verify a shared secret, then trigger an immediate ingest cycle
 * (which re-fetches /success-otp from STEX as the source of truth and
 * matches it against pending allocations). This eliminates the 4s
 * polling lag for OTP delivery while staying robust if the webhook
 * payload is incomplete/spoofed.
 *
 * Configure on STEX dashboard:
 *   URL:    https://<your-domain>/api/public/stex/webhook
 *   Header: x-stex-secret: <STEX_WEBHOOK_SECRET>
 *   Method: POST
 *
 * Falls back gracefully — even if STEX has no signature support, set a
 * secret header in their UI; the endpoint rejects anything without it.
 */
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-stex-secret, Authorization",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/stex/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => json({ ok: true, hint: "POST OTP events here" }),

      POST: async ({ request }) => {
        const secret = process.env.STEX_WEBHOOK_SECRET || "";
        if (!secret) {
          console.error("[stex-webhook] STEX_WEBHOOK_SECRET not configured");
          return json({ error: "Webhook secret not configured" }, 500);
        }

        const provided =
          request.headers.get("x-stex-secret") ||
          request.headers.get("x-webhook-secret") ||
          "";
        if (provided !== secret) {
          return json({ error: "Unauthorized" }, 401);
        }

        // Best-effort payload log (helps STEX format debugging).
        let payloadPreview: unknown = null;
        try {
          const text = await request.text();
          if (text) {
            try { payloadPreview = JSON.parse(text); } catch { payloadPreview = text.slice(0, 200); }
          }
        } catch { /* ignore body parse */ }
        console.log("[stex-webhook] received", payloadPreview);

        // Re-fetch from STEX as source of truth → match → credit.
        try {
          const { forcePollerIngest } = await import("@/lib/poller.server");
          await forcePollerIngest("stex-webhook");
        } catch (e: any) {
          console.error("[stex-webhook] ingest failed", e);
          return json({ ok: false, error: e?.message || "ingest failed" }, 500);
        }

        return json({ ok: true });
      },
    },
  },
});
