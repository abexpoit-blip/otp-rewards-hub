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
const MANUAL_TRIGGER_MIN_MS = Math.max(1500, Math.min(POLL_INTERVAL_MS - 250, 3500));

type PollerState = {
  started: boolean;
  lastTick: number;
  lastError: string | null;
  ingestPromise?: Promise<void>;
};

declare global {
  // eslint-disable-next-line no-var
  var __nexusPoller: PollerState | undefined;
}

export function getPollerStatus() {
  return globalThis.__nexusPoller ?? { started: false, lastTick: 0, lastError: null };
}

export function ensurePollerStarted() {
  if (globalThis.__nexusPoller?.started) return globalThis.__nexusPoller;
  const state: PollerState = { started: true, lastTick: 0, lastError: null };
  globalThis.__nexusPoller = state;

  console.log(
    `[poller] started — STEX poll every ${POLL_INTERVAL_MS}ms, expiry sweep every ${EXPIRE_INTERVAL_MS}ms`,
  );

  setInterval(() => {
    void runIngest(state, "timer");
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

  return state;
}

export async function triggerPollerIngest(reason = "manual") {
  const state = ensurePollerStarted();
  if (Date.now() - state.lastTick < MANUAL_TRIGGER_MIN_MS) return;
  await runIngest(state, reason);
}

/** Bypass throttle — used by STEX webhook for instant delivery. */
export async function forcePollerIngest(reason = "webhook") {
  const state = ensurePollerStarted();
  await runIngest(state, reason);
}

async function runIngest(state: PollerState, source: string) {
  if (state.ingestPromise) return state.ingestPromise;

  state.ingestPromise = (async () => {
    try {
      await ingestOnce();
      state.lastTick = Date.now();
      state.lastError = null;
    } catch (e: any) {
      state.lastError = e?.message || String(e);
      console.error(`[poller] ${source} ingest failed`, e);
    } finally {
      state.ingestPromise = undefined;
    }
  })();

  return state.ingestPromise;
}

async function ingestOnce() {
  const { getSetting } = await import("./settings.server");
  const defaultPayout = Number(await getSetting("default_payout", 0.40));
  const r = await stexSuccessOtp();
  if (r.meta.code !== 200 || !r.data) return;
  if (r.data.otps.length) console.log(`[poller] fetched ${r.data.otps.length} OTP(s) from STEX`);

  for (const otp of r.data.otps) {
    const otpDigits = String(otp.number || "").replace(/\D/g, "");
    if (!otpDigits) continue;
    const otpReceivedAt = new Date(Number(otp.time) || Date.now());
    // Match against the most recent allocation for this number (any status, last 24h).
    // - 'pending'/'failed'/'expired' → first OTP pays out
    // - 'success' → duplicate OTP; we still SAVE it (inbox visible) but DO NOT pay again
    const matches = await sql<any[]>`
      SELECT id, user_id, sid, country, full_number, no_plus_number, national_number, status::text AS status
      FROM allocations
      WHERE created_at >= now() - interval '24 hours'
        AND ${otpReceivedAt} >= created_at - interval '2 minutes'
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
      console.log(`[poller] no allocation matches OTP number=${otp.number} (digits=${otpDigits})`);
      continue;
    }
    const alloc = matches[0];
    console.log(`[poller] matched OTP ${otp.otp_id} → allocation ${alloc.id} (${alloc.full_number}) status=${alloc.status}`);

    // Always insert the message — duplicates are blocked only via stex_otp_id uniqueness.
    const inserted = await sql<any[]>`
      INSERT INTO otp_messages (allocation_id, user_id, number, body, stex_otp_id, received_at)
      VALUES (${alloc.id}, ${alloc.user_id}, ${otp.number}, ${otp.message},
              ${otp.otp_id}, to_timestamp(${otp.time / 1000}))
      ON CONFLICT (stex_otp_id) DO NOTHING
      RETURNING id
    `;
    // NOTE: even on duplicate (inserted.length===0) we still attempt to promote
    // the allocation — previous cycle may have inserted the msg but failed to
    // update the allocation. The UPDATE below is idempotent via status check.

    if (alloc.status === "success") {
      if (inserted.length > 0) console.log(`[poller] extra OTP for already-paid allocation ${alloc.id} — no extra payout`);
      continue;
    }

    // Per-user rate (set by agent/admin) + agent commission split.
    const [u] = await sql<any[]>`
      SELECT otp_rate::text AS rate, agent_id FROM users WHERE id = ${alloc.user_id}
    `;
    const userPayout = u?.rate != null ? Number(u.rate) : defaultPayout;
    const fullRate = defaultPayout;
    const agentId: string | null = u?.agent_id && u.agent_id !== alloc.user_id ? u.agent_id : null;
    const commission = agentId ? Math.max(0, Number((fullRate - userPayout).toFixed(4))) : 0;

    const updated = await sql<any[]>`
      UPDATE allocations
      SET status = 'success',
          payout_amount = ${userPayout},
          agent_id = ${agentId},
          agent_commission = ${commission},
          completed_at = now()
      WHERE id = ${alloc.id} AND status IN ('pending', 'failed', 'expired')
      RETURNING id
    `;
    if (updated.length === 0) continue;
    await sql`
      UPDATE users
      SET balance = balance + ${userPayout}, lifetime_earning = lifetime_earning + ${userPayout}
      WHERE id = ${alloc.user_id}
    `;
    if (agentId && commission > 0) {
      await sql`
        UPDATE users
        SET balance = balance + ${commission}, lifetime_earning = lifetime_earning + ${commission}
        WHERE id = ${agentId}
      `;
      console.log(`[poller] agent commission ৳${commission} → agent ${agentId} (user rate ৳${userPayout}, full ৳${fullRate})`);
    }
    if (alloc.status !== "pending") {
      console.log(`[poller] recovered allocation ${alloc.id} from '${alloc.status}' → success (OTP arrived after timeout)`);
    }
  }

  // ---- Recovery sweep: failed/expired allocations that already have an OTP
  // message but weren't credited (race, old bug). Idempotent — only acts when
  // status is still failed/expired AND payout_amount = 0.
  try {
    const orphans = await sql<any[]>`
      SELECT DISTINCT a.id, a.user_id, a.status::text AS status
      FROM allocations a
      WHERE a.status IN ('failed', 'expired')
        AND a.payout_amount = 0
        AND a.created_at >= now() - interval '24 hours'
        AND EXISTS (SELECT 1 FROM otp_messages m WHERE m.allocation_id = a.id)
      LIMIT 100
    `;
    for (const o of orphans) {
      const [u] = await sql<any[]>`
        SELECT otp_rate::text AS rate, agent_id FROM users WHERE id = ${o.user_id}
      `;
      const userPayout = u?.rate != null ? Number(u.rate) : defaultPayout;
      const fullRate = defaultPayout;
      const agentId: string | null = u?.agent_id && u.agent_id !== o.user_id ? u.agent_id : null;
      const commission = agentId ? Math.max(0, Number((fullRate - userPayout).toFixed(4))) : 0;
      const upd = await sql<any[]>`
        UPDATE allocations
        SET status='success', payout_amount=${userPayout},
            agent_id=${agentId}, agent_commission=${commission},
            completed_at=COALESCE(completed_at, now())
        WHERE id=${o.id} AND status IN ('failed','expired') AND payout_amount=0
        RETURNING id
      `;
      if (upd.length === 0) continue;
      await sql`UPDATE users SET balance=balance+${userPayout}, lifetime_earning=lifetime_earning+${userPayout} WHERE id=${o.user_id}`;
      if (agentId && commission > 0) {
        await sql`UPDATE users SET balance=balance+${commission}, lifetime_earning=lifetime_earning+${commission} WHERE id=${agentId}`;
      }
      console.log(`[poller] recovery sweep: allocation ${o.id} (${o.status}) → success, credited ৳${userPayout}`);
    }
  } catch (e) {
    console.error("[poller] recovery sweep failed", e);
  }
}
