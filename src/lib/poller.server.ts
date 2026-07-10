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
  const defaultPayout = Number(await getSetting("default_payout", 0.75));
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
          OR (regexp_replace(COALESCE(national_number,''), '\D','','g') <> ''
              AND ${otpDigits} LIKE '%' || regexp_replace(COALESCE(national_number,''), '\D','','g'))
          OR (regexp_replace(COALESCE(full_number,''),     '\D','','g') <> ''
              AND regexp_replace(COALESCE(full_number,''),     '\D','','g') LIKE '%' || ${otpDigits})
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

    const settled = await settleAllocation(alloc.id, alloc.user_id, alloc.status, defaultPayout, otp.message, otpReceivedAt);
    if (!settled) continue;
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
      WHERE a.status IN ('pending', 'failed', 'expired')
        AND a.payout_amount = 0
        AND a.created_at >= now() - interval '24 hours'
        AND EXISTS (
          SELECT 1 FROM otp_messages m
          WHERE m.allocation_id = a.id
             OR (m.user_id = a.user_id AND m.received_at >= a.created_at - interval '2 minutes' AND (
                  regexp_replace(COALESCE(m.number,''), '\D','','g') = regexp_replace(COALESCE(a.full_number,''), '\D','','g')
               OR regexp_replace(COALESCE(m.number,''), '\D','','g') = regexp_replace(COALESCE(a.no_plus_number,''), '\D','','g')
               OR regexp_replace(COALESCE(m.number,''), '\D','','g') = regexp_replace(COALESCE(a.national_number,''), '\D','','g')
               OR (regexp_replace(COALESCE(a.national_number,''), '\D','','g') <> ''
                   AND regexp_replace(COALESCE(m.number,''), '\D','','g') LIKE '%' || regexp_replace(COALESCE(a.national_number,''), '\D','','g'))
             ))
        )
      LIMIT 100
    `;
    for (const o of orphans) {
      const settled = await settleAllocation(o.id, o.user_id, o.status, defaultPayout);
      if (settled) console.log(`[poller] recovery sweep: allocation ${o.id} (${o.status}) → success, credited ৳${settled.userPayout}`);
    }
  } catch (e) {
    console.error("[poller] recovery sweep failed", e);
  }
}

type SettledAllocation = { userPayout: number; agentId: string | null; commission: number };

function extractOtpCode(message?: string | null) {
  if (!message) return null;
  return message.match(/\b\d{4,8}\b/)?.[0] ?? message;
}

async function settleAllocation(
  allocationId: string,
  userId: string,
  priorStatus: string,
  defaultPayout: number,
  otpMessage?: string | null,
  otpReceivedAt?: Date | null,
): Promise<SettledAllocation | null> {
  const result = await sql.begin(async (tx): Promise<SettledAllocation | null> => {
    const [u] = await tx<any[]>`
      SELECT otp_rate::text AS rate, agent_id
      FROM users
      WHERE id = ${userId}
      FOR UPDATE
    `;
    const userPayout = u?.rate != null ? Number(u.rate) : defaultPayout;
    const agentId: string | null = u?.agent_id && u.agent_id !== userId ? u.agent_id : null;
    // Agent commission = agent's own otp_rate − user's otp_rate.
    // (Not the global default_payout — agents can have their own rate.)
    let agentRate = defaultPayout;
    if (agentId) {
      const [a] = await tx<any[]>`SELECT otp_rate::text AS rate FROM users WHERE id = ${agentId}`;
      if (a?.rate != null) agentRate = Number(a.rate);
    }
    const commission = agentId ? Math.max(0, Number((agentRate - userPayout).toFixed(4))) : 0;
    const otpCode = extractOtpCode(otpMessage);

    const updated = await tx<any[]>`
      UPDATE allocations
      SET status = 'success',
          payout_amount = ${userPayout},
          user_payout = ${userPayout},
          agent_id = ${agentId},
          agent_commission = ${commission},
          received_at = COALESCE(received_at, ${otpReceivedAt ?? null}),
          otp_code = COALESCE(otp_code, ${otpCode}),
          completed_at = now(),
          settled_at = now()
      WHERE id = ${allocationId}
        AND status IN ('pending', 'failed', 'expired')
        AND payout_amount = 0
      RETURNING id
    `;
    if (updated.length === 0) return null;

    await tx`
      UPDATE users
      SET balance = balance + ${userPayout}, lifetime_earning = lifetime_earning + ${userPayout}
      WHERE id = ${userId}
    `;
    if (agentId && commission > 0) {
      await tx`
        UPDATE users
        SET balance = balance + ${commission}, lifetime_earning = lifetime_earning + ${commission}
        WHERE id = ${agentId}
      `;
    }
    return { userPayout, agentId, commission };
  });

  if (result?.agentId && result.commission > 0) {
    console.log(`[poller] agent commission ৳${result.commission} → agent ${result.agentId} (user rate ৳${result.userPayout}, full ৳${defaultPayout})`);
  }
  if (result && priorStatus !== "pending") {
    console.log(`[poller] settled allocation ${allocationId} from ${priorStatus}`);
  }
  return result;
}
