/**
 * Upstream SMS API client (VoltxSMS — same envelope shape as legacy Stex).
 * Base + key from env / settings. All endpoints share the `mauthapi` header.
 * Setting keys `voltx_api_base` / `voltx_api_key` win over env; legacy
 * `stex_api_*` keys are still read as fallback so existing deployments keep
 * working while migrating.
 */

async function getBase(): Promise<string> {
  try {
    const { getSetting } = await import("./settings.server");
    const v = await getSetting<string>("voltx_api_base", "");
    if (v && typeof v === "string" && v.length) return v;
    const s = await getSetting<string>("stex_api_base", "");
    if (s && typeof s === "string" && s.length) return s;
  } catch { /* settings table may not exist yet during first boot */ }
  return process.env.VOLTX_API_BASE
      || process.env.STEX_API_BASE
      || "https://api.2oo9.cloud/MXS47FLFX0U/tnevs/@public/api";
}

async function getApiKey(): Promise<string> {
  try {
    const { getSetting } = await import("./settings.server");
    const v = await getSetting<string>("voltx_api_key", "");
    if (v && typeof v === "string" && v.length) return v;
    const s = await getSetting<string>("stex_api_key", "");
    if (s && typeof s === "string" && s.length) return s;
  } catch { /* settings table may not exist yet during first boot */ }
  return process.env.VOLTX_API_KEY || process.env.STEX_API_KEY || "";
}

export type StexEnvelope<T> = {
  meta: { code: number; status: string };
  data: T | null;
  message?: string;
  rid?: string;
};

export type StexNumber = {
  full_number: string;
  national_number: string;
  no_plus_number: string;
  country: string;
  operator: string;
};

export type StexService = {
  sid: string;
  last_at: number;
  ranges: string[];
};

export type StexOtp = {
  otp_id: string;
  number: string;
  message: string;
  time: number;
};

export type StexHit = {
  range: string;
  sid: string;
  message: string;
  time: number;
};

// Throttle: enforce a min gap between STEX calls to stay under upstream
// rate limits during traffic spikes. Single shared queue per container.
const MIN_GAP_MS = Number(process.env.STEX_MIN_GAP_MS || 200);
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run as Promise<T>;
}

async function stexFetch<T>(path: string, init?: RequestInit): Promise<StexEnvelope<T>> {
  const [key, base] = await Promise.all([getApiKey(), getBase()]);
  if (!key) throw new Error("Upstream SMS API key not configured. Set it in Admin → Settings.");
  return throttle(async () => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "mauthapi": key,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    return (await res.json()) as StexEnvelope<T>;
  });
}

export function stexGetNum(rid: string) {
  return stexFetch<StexNumber>("/getnum", {
    method: "POST",
    body: JSON.stringify({ rid }),
  });
}

export function stexLiveAccess() {
  return stexFetch<{ cached: boolean; services: StexService[] }>("/liveaccess", { method: "GET" });
}

export function stexSuccessOtp() {
  return stexFetch<{ cached: boolean; otps: StexOtp[] }>("/success-otp", { method: "GET" });
}

export function stexConsole() {
  return stexFetch<{ cached: boolean; hits: StexHit[] }>("/console", { method: "GET" });
}
