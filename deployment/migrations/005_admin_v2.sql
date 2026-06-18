-- Nexus V2 — migration 005: powerful admin (Sprint 1)
-- - User control: suspend/banned_until/ban_reason/admin_notes/tokens_invalidated_at
-- - Notices: banner/popup/maintenance
-- - app_settings: maintenance_mode seed
-- Run:
--   docker exec -i nexus_db sh -c 'psql -U nexus_v2 -d nexus_v2' < deployment/migrations/005_admin_v2.sql

BEGIN;

-- ============================================================
-- USERS: add ban/suspend/notes/force-logout columns
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until            timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason              text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes             text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_invalidated_at   timestamptz NOT NULL DEFAULT to_timestamp(0);

-- ============================================================
-- NOTICES — banner / popup / maintenance announcements
-- ============================================================
DO $$ BEGIN
  CREATE TYPE notice_type AS ENUM ('banner', 'popup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notice_priority AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        notice_type NOT NULL DEFAULT 'banner',
  priority    notice_priority NOT NULL DEFAULT 'info',
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notices_active ON notices(active, starts_at, ends_at);

-- ============================================================
-- app_settings: add maintenance_mode + ban_message
-- ============================================================
INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('maintenance_mode',      'false'::jsonb,    false, 'When true, all non-admin requests are blocked'),
  ('maintenance_message',   '"We are upgrading the system. Please check back shortly."'::jsonb, false, 'Message shown to users during maintenance')
ON CONFLICT (key) DO NOTHING;

COMMIT;
