/**
 * STEX SMS upstream API client.
 * Base + key from env. All endpoints share the `mauthapi` header.
 */

const BASE = process.env.STEX_API_BASE || "https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api";
const KEY = process.env.STEX_API_KEY || "";

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

async function stexFetch<T>(path: string, init?: RequestInit): Promise<StexEnvelope<T>> {
  if (!KEY) throw new Error("STEX_API_KEY not configured on server.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "mauthapi": KEY,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json()) as StexEnvelope<T>;
  return json;
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
