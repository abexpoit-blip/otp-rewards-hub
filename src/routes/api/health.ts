import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { sql } = await import("@/lib/db.server");
          const [row] = await sql`SELECT 1 as ok, now() as ts`;
          return Response.json({ ok: true, db: row?.ok === 1, ts: row?.ts });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: String(e?.message || e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
