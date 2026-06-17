-- Nexus V2 — initial schema
-- Run inside nexus_db Postgres against nexus_v2 database:
--   docker exec -i nexus_db sh -c 'psql -U nexus_v2 -d nexus_v2' < deployment/migrations/001_init.sql

BEGIN;

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;       -- case-insensitive email

-- ============================================================
-- Enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('user', 'teamlead', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'blocked', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE allocation_status AS ENUM ('pending', 'success', 'failed', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            citext UNIQUE NOT NULL,
  password_hash    text NOT NULL,
  name             text,
  phone            text,
  status           user_status NOT NULL DEFAULT 'active',
  balance          numeric(18,4) NOT NULL DEFAULT 0,
  lifetime_earning numeric(18,4) NOT NULL DEFAULT 0,
  country          text,
  city             text,
  timezone         text,
  telegram         text,
  bio              text,
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- user_roles (separate table — prevent privilege escalation)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============================================================
-- sessions (login history — last N per user shown in profile)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip         text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, created_at DESC);

-- ============================================================
-- announcements (admin global banner)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message    text NOT NULL,
  severity   text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','success','error')),
  active     boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ranges (cached from stex /liveaccess + admin-managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS ranges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     text NOT NULL,        -- e.g. "Telegram", "WhatsApp"
  range_pattern text NOT NULL,        -- e.g. "8801711XXX"
  country       text,
  operator      text,
  active        boolean NOT NULL DEFAULT true,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, range_pattern)
);

CREATE INDEX IF NOT EXISTS idx_ranges_pattern ON ranges(range_pattern);
CREATE INDEX IF NOT EXISTS idx_ranges_sender ON ranges(sender_id);

-- ============================================================
-- allocations (a user requested a number)
-- ============================================================
CREATE TABLE IF NOT EXISTS allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rid             text NOT NULL,
  full_number     text,
  national_number text,
  no_plus_number  text,
  country         text,
  operator        text,
  status          allocation_status NOT NULL DEFAULT 'pending',
  payout_amount   numeric(18,4) NOT NULL DEFAULT 0,
  stex_response   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_alloc_user ON allocations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alloc_status ON allocations(status);
CREATE INDEX IF NOT EXISTS idx_alloc_number ON allocations(full_number);

-- ============================================================
-- otp_messages (incoming OTPs linked to allocations)
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid REFERENCES allocations(id) ON DELETE SET NULL,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  number        text,
  sender        text,
  body          text NOT NULL,
  carrier       text,
  country       text,
  stex_otp_id   text UNIQUE,
  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_alloc ON otp_messages(allocation_id);

-- ============================================================
-- payment_addresses (user's wallets)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_addresses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gateway    text NOT NULL,            -- e.g. "USDT-SOL", "bKash"
  address    text NOT NULL,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payaddr_user ON payment_addresses(user_id);

-- ============================================================
-- withdrawals
-- ============================================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       numeric(18,4) NOT NULL CHECK (amount > 0),
  gateway      text NOT NULL,
  address      text NOT NULL,
  status       withdrawal_status NOT NULL DEFAULT 'pending',
  tx_id        text,
  admin_note   text,
  processed_by uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wd_user ON withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals(status);

-- ============================================================
-- api_keys (per-user, for external bots)
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash     text UNIQUE NOT NULL,
  key_prefix   text NOT NULL,         -- show first 8 chars in UI
  label        text,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apikey_user ON api_keys(user_id);

-- ============================================================
-- updated_at trigger for users
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
