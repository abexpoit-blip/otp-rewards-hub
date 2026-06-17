-- Nexus V2 — migration 004: admin control surface
-- - app_settings (hot-reload key/value config)
-- - audit_log (who did what)
-- - allocations.flags (national / no-plus per allocation)
-- Run:
--   docker exec -i nexus_db sh -c 'psql -U nexus_v2 -d nexus_v2' < deployment/migrations/004_admin_controls.sql

BEGIN;

-- ============================================================
-- app_settings — runtime config editable from Admin UI
-- value = jsonb so we can store numbers/strings/bools cleanly
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  is_secret   boolean NOT NULL DEFAULT false,
  description text,
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed defaults (idempotent)
INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('stex_api_key',           '""'::jsonb,    true,  'STEX reseller API key (mauthapi header)'),
  ('poll_interval_ms',       '4000'::jsonb,  false, 'Global poller tick (ms) for /success-otp'),
  ('expire_minutes',         '15'::jsonb,    false, 'Auto-expire pending allocations after N minutes'),
  ('default_payout',         '0.10'::jsonb,  false, 'Fallback payout per OTP if no service rule matches'),
  ('stex_revenue_per_otp',   '0.15'::jsonb,  false, 'What admin earns from STEX per successful OTP (for profit calc)'),
  ('sse_max_per_user',       '3'::jsonb,     false, 'Max concurrent SSE inbox streams per user'),
  ('signup_enabled',         'true'::jsonb,  false, 'Allow new user signups')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- audit_log — every admin action
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_log(actor_id, created_at DESC);

-- ============================================================
-- allocations.flags — per-allocation toggles (national / no_plus)
-- ============================================================
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
