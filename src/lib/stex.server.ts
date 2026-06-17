/**
 * STEX SMS upstream API client.
 * Base + key from env. All endpoints share the `mauthapi` header.
 */

const BASE = process.env.STEX_API_BASE || "https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api";

async function getApiKey(): Promise<string> {
  // Settings (DB) wins so admin can rotate without redeploy; .env is fallback.
  try {
    const { getSetting } = await import("./settings.server");
    const k = await getSetting<string>("stex_api_key", "");
    if (k && typeof k === "string" && k.length) return k;
  } catch { /* settings table may not exist yet during first boot */ }
  return process.env.STEX_API_KEY || "";
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
  const key = await getApiKey();
  if (!key) throw new Error("STEX API key not configured. Set it in Admin → Settings.");
  return throttle(async () => {
    const res = await fetch(`${BASE}${path}`, {
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
