/**
 * Global OTP poller — runs ONE shared loop per container, instead of one
 * per SSE connection. Drastically cuts STEX API hits.
 *
 * Why globalThis: docker container = long-lived Node process, modules persist.
 * HMR (dev) may re-import → globalThis flag prevents double-start.
 *
 * What it does on a timer:
 *   1. STEX /success-otp → match against pending allocations → insert OTP →
 *      credit user (idempotent via UNIQUE(stex_otp_id)).
 *   2. Mark pending allocations whose expires_at < now() as 'failed'.
 *
 * Re-entrancy guard: `ingesting` flag prevents overlap if a tick takes
 * longer than the interval (slow upstream).
 */
import { sql } from "./db.server";
import { stexSuccessOtp } from "./stex.server";

const POLL_INTERVAL_MS = Number(process.env.STEX_POLL_INTERVAL_MS || 4000); // 4s
const EXPIRE_INTERVAL_MS = 60_000; // 1 min

declare global {
  // eslint-disable-next-line no-var
  var __nexusPoller: { started: boolean; lastTick: number; lastError: string | null } | undefined;
}

export function getPollerStatus() {
  return globalThis.__nexusPoller ?? { started: false, lastTick: 0, lastError: null };
}

export function ensurePollerStarted() {
  if (globalThis.__nexusPoller?.started) return;
  const state = { started: true, lastTick: 0, lastError: null as string | null };
  globalThis.__nexusPoller = state;

  console.log(
    `[poller] started — STEX poll every ${POLL_INTERVAL_MS}ms, expiry sweep every ${EXPIRE_INTERVAL_MS}ms`,
  );

  let ingesting = false;
  setInterval(async () => {
    if (ingesting) return;
    ingesting = true;
    try {
      await ingestOnce();
      state.lastTick = Date.now();
      state.lastError = null;
    } catch (e: any) {
      state.lastError = e?.message || String(e);
      console.error("[poller] ingest failed", e);
    } finally {
      ingesting = false;
    }
  }, POLL_INTERVAL_MS);

  setInterval(async () => {
    try {
      const rows = await sql<any[]>`
        UPDATE allocations
        SET status = 'failed', completed_at = COALESCE(completed_at, now())
        WHERE status = 'pending' AND expires_at < now()
        RETURNING id
      `;
      if (rows.length) console.log(`[poller] marked ${rows.length} allocations failed (20-min timeout)`);
    } catch (e) {
      console.error("[poller] expire sweep failed", e);
    }
  }, EXPIRE_INTERVAL_MS);
}

async function ingestOnce() {
  const { getSetting } = await import("./settings.server");
  const defaultPayout = Number(await getSetting("default_payout", 0.40));
  const r = await stexSuccessOtp();
  if (r.meta.code !== 200 || !r.data) return;

  for (const otp of r.data.otps) {
    // Normalize to digits-only on both sides — STEX may return the number
    // in a different format (with/without +, with/without country code)
    // than what we stored at allocation time. Match if the upstream digits
    // equal OR end-with any of our stored variants' digits.
    const otpDigits = String(otp.number || "").replace(/\D/g, "");
    if (!otpDigits) continue;
    const matches = await sql<any[]>`
      SELECT id, user_id, sid, country, full_number, no_plus_number, national_number
      FROM allocations
      WHERE status = 'pending'
        AND (
             regexp_replace(COALESCE(full_number,''),     '\D','','g') = ${otpDigits}
          OR regexp_replace(COALESCE(no_plus_number,''),  '\D','','g') = ${otpDigits}
          OR regexp_replace(COALESCE(national_number,''), '\D','','g') = ${otpDigits}
          OR ${otpDigits} LIKE '%' || regexp_replace(COALESCE(national_number,''), '\D','','g')
          OR regexp_replace(COALESCE(full_number,''),     '\D','','g') LIKE '%' || ${otpDigits}
        )
      ORDER BY created_at DESC LIMIT 1
    `;
    if (matches.length === 0) {
      console.log(`[poller] no pending allocation matches OTP number=${otp.number} (digits=${otpDigits})`);
      continue;
    }
    const alloc = matches[0];
    console.log(`[poller] matched OTP ${otp.otp_id} → allocation ${alloc.id} (${alloc.full_number})`);

    // De-dup: UNIQUE(stex_otp_id) + ON CONFLICT DO NOTHING. RETURNING is
    // empty when a parallel insert already won → we skip crediting.
    const inserted = await sql<any[]>`
      INSERT INTO otp_messages (allocation_id, user_id, number, body, stex_otp_id, received_at)
      VALUES (${alloc.id}, ${alloc.user_id}, ${otp.number}, ${otp.message},
              ${otp.otp_id}, to_timestamp(${otp.time / 1000}))
      ON CONFLICT (stex_otp_id) DO NOTHING
      RETURNING id
    `;
    if (inserted.length === 0) continue;

    // Flat rate: every successful OTP pays the configured default_payout.
    const payout = defaultPayout;

    // Only credit if allocation was still pending (race-safe via WHERE).
    const updated = await sql<any[]>`
      UPDATE allocations
      SET status = 'success', payout_amount = ${payout}, completed_at = now()
      WHERE id = ${alloc.id} AND status = 'pending'
      RETURNING id
    `;
    if (updated.length === 0) continue; // already credited by parallel worker
    await sql`
      UPDATE users
      SET balance = balance + ${payout}, lifetime_earning = lifetime_earning + ${payout}
      WHERE id = ${alloc.user_id}
    `;
  }
}
