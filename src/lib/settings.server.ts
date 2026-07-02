/**
 * App settings — runtime config in DB, in-memory cached.
 * Cache TTL = 15s so admin edits propagate fast across all callers.
 */
import { sql } from "./db.server";

type Cache = { at: number; data: Record<string, any> };
const TTL = 15_000;
let cache: Cache | null = null;

export async function getAllSettings(): Promise<Record<string, any>> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const rows = await sql<any[]>`SELECT key, value FROM app_settings`;
  const data: Record<string, any> = {};
  for (const r of rows) data[r.key] = r.value;
  cache = { at: Date.now(), data };
  return data;
}

export async function getSetting<T = any>(key: string, fallback: T): Promise<T> {
  const all = await getAllSettings();
  return coerceSettingValue(all[key], fallback);
}

function coerceSettingValue<T = any>(value: any, fallback: T): T {
  if (value == null) return fallback;

  if (typeof fallback === "boolean") {
    if (typeof value === "boolean") return value as T;
    if (typeof value === "number") return (value !== 0) as T;
    if (typeof value === "string") {
      const normalized = value.trim().replace(/^['\"]|['\"]$/g, "").toLowerCase();
      if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true as T;
      if (["false", "0", "no", "off", "disabled", ""].includes(normalized)) return false as T;
    }
    return fallback;
  }

  if (typeof fallback === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? (n as T) : fallback;
  }

  return value as T;
}

export async function setSetting(key: string, value: any, actor: string): Promise<void> {
  await sql`
    UPDATE app_settings
    SET value = ${JSON.stringify(value)}::jsonb,
        updated_by = ${actor},
        updated_at = now()
    WHERE key = ${key}
  `;
  cache = null; // invalidate
}

export function invalidateSettings() { cache = null; }
