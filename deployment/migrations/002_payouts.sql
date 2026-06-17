-- Nexus V2 — migration 002: per-service payouts + allocation sid tracking
-- Run on VPS:
--   docker exec -i nexus_db sh -c 'psql -U nexus_v2 -d nexus_v2' < deployment/migrations/002_payouts.sql

BEGIN;

-- ============================================================
-- service_payouts: admin-defined payout per (service, country)
-- Lookup order in code:
--   1) (sid, country) exact match
--   2) (sid, NULL) service-level default
--   3) STEX_DEFAULT_PAYOUT env fallback
-- ============================================================
CREATE TABLE IF NOT EXISTS service_payouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sid         text NOT NULL,
  country     text,                             -- NULL = applies to all countries
  amount      numeric(18,4) NOT NULL CHECK (amount >= 0),
  active      boolean NOT NULL DEFAULT true,
  note        text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique on (sid, COALESCE(country,'')) so we can have one row per pair
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_payouts_sid_country
  ON service_payouts (sid, COALESCE(country, ''));

DROP TRIGGER IF EXISTS trg_payouts_updated_at ON service_payouts;
CREATE TRIGGER trg_payouts_updated_at
  BEFORE UPDATE ON service_payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- allocations.sid — track which STEX service the user picked
-- (the upstream /getnum response does NOT include sid, so we
-- capture it client-side from /liveaccess at allocation time)
-- ============================================================
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS sid text;
CREATE INDEX IF NOT EXISTS idx_alloc_sid ON allocations(sid);

COMMIT;
