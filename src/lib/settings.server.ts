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
  return (all[key] ?? fallback) as T;
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
