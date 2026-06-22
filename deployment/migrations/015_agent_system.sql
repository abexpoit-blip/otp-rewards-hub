-- Nexus V2 — migration 015: Agent (sub-admin) system
-- - Adds 'agent' role
-- - users.agent_id (referrer) + users.otp_rate (per-user payout)
-- - signup_agent_email tracking so admin-as-agent can approve their own referrals
-- - notices.audience (user | agent | both)
-- - support_threads / support_messages (agent <-> admin chat)
-- - app_settings: support_enabled toggle, max_agent_otp_rate cap
-- - Backfill: current admin gets 'agent' role + otp_rate=0.60
-- Run:
--   docker exec -i nexus_db psql -U nexus_v2 nexus_v2 < deployment/migrations/015_agent_system.sql

BEGIN;

-- NOTE: Run this file as-is. The enum ADD VALUE must commit BEFORE the value
-- can be used, so we end the implicit transaction with COMMIT and start a
-- fresh BEGIN before the rest of the migration.

-- ============================================================
-- 1. 'agent' role  (must be its own transaction)
-- ============================================================
COMMIT;
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'agent';
BEGIN;



-- ============================================================
-- 2. users: per-user rate + referring agent
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_id   uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_rate   numeric(6,4) NOT NULL DEFAULT 0.40;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_agent_email citext;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_agent_id ON users(agent_id);
CREATE INDEX IF NOT EXISTS idx_users_status_agent ON users(status, agent_id);

-- ============================================================
-- 3. notices.audience
-- ============================================================
DO $$ BEGIN
  CREATE TYPE notice_audience AS ENUM ('user', 'agent', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE notices ADD COLUMN IF NOT EXISTS audience notice_audience NOT NULL DEFAULT 'user';

-- ============================================================
-- 4. support_threads + support_messages (agent <-> admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS support_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  last_msg_at timestamptz NOT NULL DEFAULT now(),
  unread_admin int NOT NULL DEFAULT 0,
  unread_agent int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_threads_agent ON support_threads(agent_id, last_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_status ON support_threads(status, last_msg_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  sender_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('agent','admin')),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_msgs_thread ON support_messages(thread_id, created_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_threads  TO nexus_v2;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO nexus_v2;

-- ============================================================
-- 5. app_settings: support toggle + agent rate cap
-- ============================================================
INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('support_enabled',     'true'::jsonb,  false, 'Agent → Admin support inbox accepts new messages'),
  ('max_agent_otp_rate',  '0.70'::jsonb,  false, 'Hard cap on per-user OTP rate (BDT)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 6. Backfill: current admin(s) become agents too, set their rate
--    so existing admin can also accept users signed up with admin email.
-- ============================================================
INSERT INTO user_roles (user_id, role)
SELECT ur.user_id, 'agent'::app_role
FROM user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;

-- Existing admin users: set OTP rate to current flat rate (0.60)
UPDATE users SET otp_rate = 0.60
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  AND otp_rate = 0.40;

-- Existing users: keep them all 'active' (no surprise re-approval needed)
-- and copy admin's rate as their default
UPDATE users SET otp_rate = 0.60 WHERE otp_rate = 0.40;

COMMIT;
