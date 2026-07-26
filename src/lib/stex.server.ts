/**
 * Upstream SMS provider client — ZENEX NETWORK (Core API v4).
 *
 * The exported function names / return shapes are unchanged (legacy "stex*"
 * naming) so every caller — poller, get-number, console, access-list, bulk,
 * bot API — keeps working with zero changes. Only the transport below is new.
 *
 * Zenex endpoints:
 *   POST {base}/getnum              → provision a number
 *   GET  {base}/numsuccess/info     → live OTP feed for this key
 *   GET  {base}/active-ranges       → global live routing matrix (access list)
 *   GET  {web}/api/live-console     → global console feed (public)
 *
 * Auth header: `mapikey: <API_KEY>`
 *
 * Settings keys (DB, hot-swappable from Admin → Settings), first match wins:
 *   zenex_api_base / zenex_api_key   ← current
 *   voltx_api_base / voltx_api_key   ← legacy fallback
 *   stex_api_base  / stex_api_key    ← legacy fallback
 */

const ZENEX_DEFAULT_BASE = "https://api.zenexnetwork.com/v1";
const ZENEX_DEFAULT_WEB = "https://zenexnetwork.com";

async function readSetting(key: string): Promise<string> {
  try {
    const { getSetting } = await import("./settings.server");
    const v = await getSetting<string>(key, "");
    if (v && typeof v === "string" && v.length) return v;
  } catch { /* settings table may not exist yet during first boot */ }
  return "";
}

async function getBase(): Promise<string> {
  const v = (await readSetting("zenex_api_base")) || (await readSetting("voltx_api_base")) || (await readSetting("stex_api_base"));
  const base = v || process.env.ZENEX_API_BASE || process.env.VOLTX_API_BASE || process.env.STEX_API_BASE || ZENEX_DEFAULT_BASE;
  return base.replace(/\/+$/, "");
}

async function getWebBase(): Promise<string> {
  const v = await readSetting("zenex_web_base");
  return (v || process.env.ZENEX_WEB_BASE || ZENEX_DEFAULT_WEB).replace(/\/+$/, "");
}

async function getApiKey(): Promise<string> {
  const v = (await readSetting("zenex_api_key")) || (await readSetting("voltx_api_key")) || (await readSetting("stex_api_key"));
  return v || process.env.ZENEX_API_KEY || process.env.VOLTX_API_KEY || process.env.STEX_API_KEY || "";
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

// Throttle: enforce a min gap between upstream calls to stay under provider
// rate limits (Zenex firewall = 429) during traffic spikes. One shared queue.
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

type RawEnvelope = {
  meta?: { code?: number; status?: string };
  data?: any;
  message?: string;
  success?: boolean;
  [k: string]: any;
};

/** Out-of-stock detection — Zenex answers with a plain error message. */
function isOutOfStock(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("no numbers available") || m.includes("out of stock") || m.includes("not found");
}

async function zenexFetch(path: string, init?: RequestInit): Promise<RawEnvelope> {
  const [key, base] = await Promise.all([getApiKey(), getBase()]);
  if (!key) throw new Error("Upstream SMS API key not configured. Set it in Admin → Settings.");
  return throttle(async () => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        mapikey: key,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    let json: RawEnvelope;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { message: text.slice(0, 200) };
    }
    if (!json.meta) json.meta = {};
    if (json.meta.code == null) json.meta.code = res.ok && json.meta.status !== "error" ? 200 : res.status || 500;
    if (!json.meta.status) json.meta.status = json.meta.code === 200 ? "success" : "error";
    return json;
  });
}

const onlyDigits = (s: string) => String(s ?? "").replace(/\D/g, "");

// ---------------------------------------------------------------- getnum ----
export async function stexGetNum(
  rid: string,
  opts?: { national?: boolean; no_plus?: boolean },
): Promise<StexEnvelope<StexNumber>> {
  const raw = await zenexFetch("/getnum", {
    method: "POST",
    body: JSON.stringify({
      range: rid,
      is_national: !!opts?.national,
      remove_plus: !!opts?.no_plus,
    }),
  });

  if (raw.meta!.code !== 200 || !raw.data) {
    const msg = raw.message || "Upstream allocation failed";
    return {
      meta: { code: isOutOfStock(msg) ? 2946 : raw.meta!.code!, status: isOutOfStock(msg) ? "not_found" : "error" },
      data: null,
      message: msg,
    };
  }

  const d = raw.data;
  const digits = onlyDigits(d.full_number || d.number || d.copy);
  // Zenex only returns one rendered form (`copy`) plus the E.164 digits.
  // When the caller asked for the national format, `copy` holds it.
  const national = opts?.national ? String(d.copy || d.number || digits) : digits;

  return {
    meta: { code: 200, status: "ok" },
    data: {
      full_number: `+${digits}`,
      national_number: national,
      no_plus_number: digits,
      country: d.country ?? "",
      operator: d.operator ?? "",
    },
    message: raw.message,
  };
}

// ----------------------------------------------------------- active ranges --
export function stexLiveAccess(): Promise<StexEnvelope<{ cached: boolean; services: StexService[] }>> {
  return zenexFetch("/active-ranges", { method: "GET" }).then((raw) => {
    const list: any[] = raw?.data?.active_ranges ?? [];
    const now = Date.now();
    const byService = new Map<string, Set<string>>();
    for (const r of list) {
      const sid = String(r?.service || "Other").trim() || "Other";
      const range = String(r?.range || "").trim();
      if (!range) continue;
      if (!byService.has(sid)) byService.set(sid, new Set());
      byService.get(sid)!.add(range);
    }
    const services: StexService[] = [...byService.entries()].map(([sid, ranges]) => ({
      sid,
      last_at: now,
      ranges: [...ranges],
    }));
    return {
      meta: { code: raw.meta!.code!, status: raw.meta!.status! },
      data: { cached: !!raw.cached, services },
      message: raw.message,
    };
  });
}

// -------------------------------------------------------------- OTP feed ----
function parseZenexTime(v: any): number {
  if (typeof v === "number" && Number.isFinite(v)) return v > 1e12 ? v : v * 1000;
  if (typeof v === "string" && v.length) {
    // "2024-05-18 14:45:12" — provider serves UTC
    const iso = v.includes("T") ? v : v.replace(" ", "T") + (/[zZ+]/.test(v) ? "" : "Z");
    const t = Date.parse(iso);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

export function stexSuccessOtp(): Promise<StexEnvelope<{ cached: boolean; otps: StexOtp[] }>> {
  return zenexFetch("/numsuccess/info", { method: "GET" }).then((raw) => {
    const list: any[] = raw?.data?.otps ?? [];
    const otps: StexOtp[] = list.map((o) => {
      const number = String(o?.number ?? "");
      const time = parseZenexTime(o?.created_at ?? o?.time);
      return {
        otp_id: String(o?.nid || o?.otp_id || `${onlyDigits(number)}_${time}`),
        number,
        message: String(o?.otp ?? o?.message ?? ""),
        time,
      };
    });
    return {
      meta: { code: raw.meta!.code!, status: raw.meta!.status! },
      data: { cached: false, otps },
      message: raw.message,
    };
  });
}

// --------------------------------------------------------- console feed -----
/** Global live console. Zenex serves this from the web app, not the v1 API. */
export async function stexConsole(): Promise<StexEnvelope<{ cached: boolean; hits: StexHit[] }>> {
  const web = await getWebBase();
  try {
    const res = await throttle(() => fetch(`${web}/api/live-console?t=${Date.now()}`, { method: "GET" }));
    const raw: any = await res.json().catch(() => ({}));
    const logs: any[] = raw?.logs ?? raw?.data?.logs ?? [];
    const hits: StexHit[] = logs.map((l) => {
      const digits = onlyDigits(l?.number);
      const range = digits ? `${digits.slice(0, 6)}XXX` : "";
      return {
        range,
        sid: String(l?.service || "Other"),
        message: String(l?.otp ?? l?.message ?? ""),
        time: parseZenexTime(l?.createdAt ?? l?.created_at ?? l?.time),
      };
    });
    return { meta: { code: res.ok ? 200 : res.status, status: res.ok ? "ok" : "error" }, data: { cached: true, hits } };
  } catch (e: any) {
    return { meta: { code: 502, status: "error" }, data: null, message: e?.message || "Console feed unavailable" };
  }
}
