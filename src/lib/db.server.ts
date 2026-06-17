/**
 * Postgres client singleton.
 * VPS এ nexus_db (existing Postgres container) এর nexus_v2 database এ connect হয়।
 * DATABASE_URL env var থেকে read হয়, .env এ defined।
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  // Build time এ undefined হতে পারে — runtime error দিব handler এ
  console.warn("[db] DATABASE_URL not set (ok at build time, must be set at runtime)");
}

declare global {
  // eslint-disable-next-line no-var
  var __nexusPg: ReturnType<typeof postgres> | undefined;
}

export const sql =
  globalThis.__nexusPg ??
  postgres(url || "postgres://invalid:invalid@localhost/invalid", {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
  });

if (!globalThis.__nexusPg) {
  globalThis.__nexusPg = sql;
}

export type DB = typeof sql;
