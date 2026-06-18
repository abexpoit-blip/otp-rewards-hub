/**
 * Public cron endpoint — call daily to delete users inactive for 14+ days.
 * Caller must provide header: x-cron-secret = CRON_SECRET env var.
 *
 * Crontab example (VPS):
 *   30 3 * * * curl -fsS -X POST https://v2.nexus-x.site/api/public/cron/cleanup-inactive \
 *     -H "x-cron-secret: $CRON_SECRET" >/dev/null
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/cleanup-inactive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || secret.length < 12) {
          return new Response("CRON_SECRET not configured", { status: 500 });
        }
        const got = request.headers.get("x-cron-secret");
        if (got !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { sql } = await import("@/lib/db.server");
        const days = Number(new URL(request.url).searchParams.get("days") || 14);
        const [r] = await sql<{ deleted: number }[]>`
          SELECT cleanup_inactive_users(${days})::int AS deleted
        `;
        return Response.json({ ok: true, deleted: r?.deleted ?? 0, days });
      },
    },
  },
});
