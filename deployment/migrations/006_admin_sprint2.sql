-- Nexus V2 — migration 006: Sprint 2
-- - Payment gateways (admin-controlled)
-- - Notice targeting (all users or custom user list)
-- Run:
--   docker exec -i nexus_db sh -c 'psql -U nexus_v2 -d nexus_v2' < deployment/migrations/006_admin_sprint2.sql

BEGIN;

-- ============================================================
-- payment_gateways — admin-controlled withdrawal gateways
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_gateways (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text UNIQUE NOT NULL,            -- e.g. "USDT-TRC20"
  name               text NOT NULL,                   -- display name
  enabled            boolean NOT NULL DEFAULT true,
  min_amount         numeric(18,4) NOT NULL DEFAULT 1,
  max_amount         numeric(18,4) NOT NULL DEFAULT 100000,
  fee_percent        numeric(6,3)  NOT NULL DEFAULT 0,   -- e.g. 1.5 = 1.5%
  fee_flat           numeric(18,4) NOT NULL DEFAULT 0,
  auto_approve_under numeric(18,4),                    -- NULL = never auto-approve
  instructions       text,
  sort_order         int NOT NULL DEFAULT 100,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_gateways_updated_at ON payment_gateways;
CREATE TRIGGER trg_gateways_updated_at
  BEFORE UPDATE ON payment_gateways
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed common gateways (idempotent)
INSERT INTO payment_gateways (code, name, enabled, min_amount, max_amount, fee_percent, sort_order) VALUES
  ('USDT-TRC20', 'USDT (TRC20)', true,  2,  100000, 0,   10),
  ('USDT-BEP20', 'USDT (BEP20)', true,  2,  100000, 0,   20),
  ('USDT-SOL',   'USDT (Solana)',true,  2,  100000, 0,   30),
  ('bKash',      'bKash',         true,  5,  50000,  1.5, 40),
  ('Nagad',      'Nagad',         true,  5,  50000,  1.5, 50),
  ('Bank',       'Bank Transfer', true, 10,  500000, 0,   60)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- notices.target_user_ids — NULL/empty = all users, else specific
-- ============================================================
ALTER TABLE notices ADD COLUMN IF NOT EXISTS target_user_ids uuid[];
CREATE INDEX IF NOT EXISTS idx_notices_targets ON notices USING gin (target_user_ids);

COMMIT;
