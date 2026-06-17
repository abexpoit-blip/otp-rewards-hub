/**
 * SSE stream of OTPs for the signed-in user.
 *
 * Architecture: a SINGLE global poller (src/lib/poller.server.ts) calls STEX
 * and writes to the DB. This stream just reads new rows from the DB per
 * connection — no per-connection STEX calls.
 *
 * Per-user rate limit: max 3 concurrent SSE connections. Excess → 429.
 *
 * Auth: EventSource cannot set headers, so the JWT is passed via ?token=…
 * Nginx note: X-Accel-Buffering: no disables proxy buffering for instant flush.
 */
import { createFileRoute } from "@tanstack/react-router";

const MAX_CONNS_PER_USER = 3;

declare global {
  // eslint-disable-next-line no-var
  var __sseConns: Map<string, number> | undefined;
}
const conns = (globalThis.__sseConns ??= new Map<string, number>());

export const Route = createFileRoute("/api/inbox/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return new Response("missing token", { status: 401 });

        const { verifyToken } = await import("@/lib/jwt.server");
        let userId: string;
        try {
          userId = verifyToken(token).sub;
        } catch {
          return new Response("invalid token", { status: 401 });
        }

        // Rate-limit: cap concurrent connections per user
        const cur = conns.get(userId) ?? 0;
        if (cur >= MAX_CONNS_PER_USER) {
          return new Response("too many concurrent streams", { status: 429 });
        }
        conns.set(userId, cur + 1);

        const { sql } = await import("@/lib/db.server");
        const { ensurePollerStarted } = await import("@/lib/poller.server");
        ensurePollerStarted();

        const encoder = new TextEncoder();
        let cursor = new Date();
        let stopped = false;

        const release = () => {
          const n = (conns.get(userId) ?? 1) - 1;
          if (n <= 0) conns.delete(userId);
          else conns.set(userId, n);
        };

        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, payload: unknown) => {
              if (stopped) return;
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
                );
              } catch {
                stopped = true;
              }
            };

            try {
              const backlog = await sql<any[]>`
                SELECT id, number, sender, body, country, received_at
                FROM otp_messages
                WHERE user_id = ${userId}
                ORDER BY received_at DESC LIMIT 20
              `;
              if (backlog.length) {
                send("backlog", backlog.map((r) => ({
                  id: r.id, number: r.number, sender: r.sender,
                  body: r.body, country: r.country,
                  received_at: r.received_at.toISOString(),
                })));
                cursor = backlog[0].received_at;
              }
            } catch (e) {
              console.error("[sse] backlog failed", e);
            }
            send("connected", { ts: Date.now() });

            const tick = async () => {
              if (stopped) return;
              try {
                const rows = await sql<any[]>`
                  SELECT id, number, sender, body, country, received_at
                  FROM otp_messages
                  WHERE user_id = ${userId} AND received_at > ${cursor}
                  ORDER BY received_at ASC LIMIT 50
                `;
                if (rows.length) {
                  send("otp", rows.map((r) => ({
                    id: r.id, number: r.number, sender: r.sender,
                    body: r.body, country: r.country,
                    received_at: r.received_at.toISOString(),
                  })));
                  cursor = rows[rows.length - 1].received_at;
                }
                send("ping", { ts: Date.now() });
              } catch (e) {
                console.error("[sse] tick failed", e);
              }
              if (!stopped) setTimeout(tick, 2500);
            };
            setTimeout(tick, 1000);

            request.signal.addEventListener("abort", () => {
              stopped = true;
              release();
              try { controller.close(); } catch {}
            });

            // Hard cap: 5 min per connection — client EventSource auto-reconnects
            setTimeout(() => {
              if (stopped) return;
              stopped = true;
              release();
              try { controller.close(); } catch {}
            }, 5 * 60 * 1000);
          },
          cancel() {
            if (!stopped) {
              stopped = true;
              release();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
