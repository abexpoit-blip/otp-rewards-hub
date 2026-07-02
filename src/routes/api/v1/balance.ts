import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/balance")({
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
          const { sql } = await import("@/lib/db.server");
          const [u] = await sql<any[]>`
            SELECT email::text AS email, balance::text AS balance,
                   lifetime_earning::text AS lifetime_earning,
                   otp_rate::text AS otp_rate
            FROM users WHERE id = ${auth.userId}
          `;
          return jsonResponse({
            ok: true,
            email: u.email,
            balance: Number(u.balance),
            lifetime_earning: Number(u.lifetime_earning),
            otp_rate: Number(u.otp_rate),
            currency: "BDT",
          });
        } catch (e) { return errorResponse(e); }
      },
    },
  },
});
