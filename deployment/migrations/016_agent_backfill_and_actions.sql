-- Nexus V2 — migration 016: agent system follow-up
-- 1. Backfill: any existing user without agent_id moves under the first admin
--    (so the admin can manage them from the agent panel too)
-- 2. Make sure admin users themselves have NULL agent_id (they're not "under" anyone)
-- 3. Index for bulk operations
-- Run:
--   docker exec -i nexus_db psql -U nexus_v2 nexus_v2 < deployment/migrations/016_agent_backfill_and_actions.sql

BEGIN;

-- Pick the lowest-created admin as the default "owning agent" for all legacy users
WITH default_admin AS (
  SELECT u.id
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
  ORDER BY u.created_at ASC
  LIMIT 1
)
UPDATE users u
SET agent_id = (SELECT id FROM default_admin),
    signup_agent_email = COALESCE(u.signup_agent_email, (SELECT email::text FROM users WHERE id = (SELECT id FROM default_admin)))
WHERE u.agent_id IS NULL
  AND u.id <> (SELECT id FROM default_admin)
  AND (SELECT id FROM default_admin) IS NOT NULL;

-- Admins themselves: no upstream agent
UPDATE users
SET agent_id = NULL
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'admin');

CREATE INDEX IF NOT EXISTS idx_users_agent_status ON users(agent_id, status);

COMMIT;
