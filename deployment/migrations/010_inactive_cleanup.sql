-- 010_inactive_cleanup.sql
-- Auto-cleanup of inactive accounts (no login in N days).
-- Safe-by-design: never deletes admins, and skips users with positive balance OR pending withdrawals
-- so we don't accidentally vaporize money.

CREATE INDEX IF NOT EXISTS idx_users_last_login ON users (last_login_at);

-- Returns the number of users actually deleted.
CREATE OR REPLACE FUNCTION cleanup_inactive_users(p_days int DEFAULT 14)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  WITH victims AS (
    SELECT u.id
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
    LEFT JOIN withdrawals w  ON w.user_id  = u.id AND w.status IN ('pending','approved')
    WHERE ur.user_id IS NULL                       -- never delete admins
      AND w.id IS NULL                              -- never delete users with pending payouts
      AND COALESCE(u.balance, 0) <= 0               -- safety: skip users holding funds
      AND COALESCE(u.last_login_at, u.created_at)
            < (now() - (p_days || ' days')::interval)
      AND u.created_at < (now() - (p_days || ' days')::interval)
    GROUP BY u.id
  ),
  del AS (
    DELETE FROM users WHERE id IN (SELECT id FROM victims) RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM del;

  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_inactive_users(int) TO PUBLIC;
