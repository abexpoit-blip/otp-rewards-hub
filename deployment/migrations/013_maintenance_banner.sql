-- Nexus V2 — migration 013: soft maintenance banner toggle
-- Adds a separate "banner only" maintenance mode.
--
-- Two-tier maintenance model:
--   1) maintenance_mode (existing)        → FULL: non-admins blocked (login + meFn 503)
--   2) maintenance_banner_enabled (NEW)   → SOFT: users still log in & use app, just see a banner
--
-- Run:
--   docker exec -i nexus_db psql -U nexus_v2 nexus_v2 < deployment/migrations/013_maintenance_banner.sql

BEGIN;

INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('maintenance_banner_enabled', 'false'::jsonb, false, 'Soft maintenance: app still works, users see a maintenance banner')
ON CONFLICT (key) DO NOTHING;

COMMIT;
