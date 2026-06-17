/**
 * SSE stream of OTPs for the signed-in user.
 *
 * Why a server route (not createServerFn): we need to stream a long-lived
 * Response with text/event-stream — server functions return serializable DTOs.
 *
 * Auth: EventSource cannot set headers, so the JWT is passed via ?token=…
 *       (verified before opening the stream).
 *
 * Flow: every 3s the server calls STEX /success-otp, ingests new OTPs into the
 *       DB (idempotent via stex_otp_id), then sends any rows newer than the
 *       last cursor as `event: otp`. A `ping` event keeps proxies alive.
 *
 * Nginx note: the `X-Accel-Buffering: no` header disables proxy buffering so
 *       events flush in real time.
 */
import { createFileRoute } from "@tanstack/react-router";

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
          const payload = verifyToken(token);
          userId = payload.sub;
        } catch {
          return new Response("invalid token", { status: 401 });
        }

        const { sql } = await import("@/lib/db.server");
        const { stexSuccessOtp } = await import("@/lib/stex.server");

        const encoder = new TextEncoder();
        let cursor = new Date();
        let stopped = false;

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

            // initial backlog — last 20 OTPs so the UI is not empty
            try {
              const backlog = await sql<any[]>`
                SELECT id, number, sender, body, country, received_at
                FROM otp_messages
                WHERE user_id = ${userId}
                ORDER BY received_at DESC LIMIT 20
              `;
              if (backlog.length) {
                send(
                  "backlog",
                  backlog.map((r) => ({
                    id: r.id, number: r.number, sender: r.sender,
                    body: r.body, country: r.country,
                    received_at: r.received_at.toISOString(),
                  })),
                );
                cursor = backlog[0].received_at;
              }
            } catch (e) {
              console.error("[sse] backlog failed", e);
            }
            send("connected", { ts: Date.now() });

            const tick = async () => {
              if (stopped) return;
              try {
                // 1. Ingest from STEX into DB (idempotent, credits balance)
                await ingestOnce(sql, stexSuccessOtp);

                // 2. Query OTPs newer than cursor for this user
                const rows = await sql<any[]>`
                  SELECT id, number, sender, body, country, received_at
                  FROM otp_messages
                  WHERE user_id = ${userId} AND received_at > ${cursor}
                  ORDER BY received_at ASC LIMIT 50
                `;
                if (rows.length) {
                  send(
                    "otp",
                    rows.map((r) => ({
                      id: r.id, number: r.number, sender: r.sender,
                      body: r.body, country: r.country,
                      received_at: r.received_at.toISOString(),
                    })),
                  );
                  cursor = rows[rows.length - 1].received_at;
                }
                send("ping", { ts: Date.now() });
              } catch (e) {
                console.error("[sse] tick failed", e);
              }
              if (!stopped) setTimeout(tick, 3000);
            };
            setTimeout(tick, 1000);

            // Close on client disconnect
            request.signal.addEventListener("abort", () => {
              stopped = true;
              try { controller.close(); } catch {}
            });

            // Hard cap: 5 minutes per connection — client EventSource auto-reconnects
            setTimeout(() => {
              stopped = true;
              try { controller.close(); } catch {}
            }, 5 * 60 * 1000);
          },
          cancel() {
            stopped = true;
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

// Shared ingestion: mirror of ingestOtpsFn but inlined to avoid pulling
// the server-fn wrapper into a streaming context. Idempotent via UNIQUE(stex_otp_id).
async function ingestOnce(
  sql: typeof import("@/lib/db.server").sql,
  stexSuccessOtp: typeof import("@/lib/stex.server").stexSuccessOtp,
) {
  const defaultPayout = Number(process.env.STEX_DEFAULT_PAYOUT || "0.10");
  const r = await stexSuccessOtp();
  if (r.meta.code !== 200 || !r.data) return;

  for (const otp of r.data.otps) {
    const matches = await sql<any[]>`
      SELECT id, user_id, sid, country FROM allocations
      WHERE status = 'pending'
        AND (no_plus_number = ${otp.number}
             OR national_number = ${otp.number}
             OR full_number = ${"+" + otp.number})
      ORDER BY created_at DESC LIMIT 1
    `;
    if (matches.length === 0) continue;
    const alloc = matches[0];

    const inserted = await sql<any[]>`
      INSERT INTO otp_messages (allocation_id, user_id, number, body, stex_otp_id, received_at)
      VALUES (${alloc.id}, ${alloc.user_id}, ${otp.number}, ${otp.message},
              ${otp.otp_id}, to_timestamp(${otp.time / 1000}))
      ON CONFLICT (stex_otp_id) DO NOTHING
      RETURNING id
    `;
    if (inserted.length === 0) continue;

    // Lookup payout: (sid, country) -> (sid, NULL) -> default
    let payout = defaultPayout;
    if (alloc.sid) {
      const p = await sql<any[]>`
        SELECT amount::numeric AS amount
        FROM service_payouts
        WHERE active = true AND sid = ${alloc.sid}
          AND (country = ${alloc.country} OR country IS NULL)
        ORDER BY country NULLS LAST LIMIT 1
      `;
      if (p.length) payout = Number(p[0].amount);
    }

    await sql`
      UPDATE allocations
      SET status = 'success', payout_amount = ${payout}, completed_at = now()
      WHERE id = ${alloc.id}
    `;
    await sql`
      UPDATE users
      SET balance = balance + ${payout}, lifetime_earning = lifetime_earning + ${payout}
      WHERE id = ${alloc.user_id}
    `;
  }
}
