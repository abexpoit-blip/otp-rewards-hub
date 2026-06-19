/**
 * Public cron — daily hard-delete of user allocations older than 24h.
 * Keeps the user "Get Number" page clean and the allocations table small.
 * Header required: x-cron-secret = CRON_SECRET.
 *
 * Crontab example:
 *   0 4 * * * curl -fsS -X POST https://v2.nexus-x.site/api/public/cron/cleanup-old-allocations \
 *     -H "x-cron-secret: $CRON_SECRET" >/dev/null
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/cleanup-old-allocations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || secret.length < 12) {
          return new Response("CRON_SECRET not configured", { status: 500 });
        }
        if (request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { sql } = await import("@/lib/db.server");
        const hours = Math.max(
          1,
          Math.min(720, Number(new URL(request.url).searchParams.get("hours") || 24)),
        );
        const [r] = await sql<{ deleted: number }[]>`
          SELECT cleanup_old_user_allocations(${hours})::int AS deleted
        `;
        return Response.json({ ok: true, deleted: r?.deleted ?? 0, hours });
      },
    },
  },
});
