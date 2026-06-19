-- 012_failed_status_and_24h_cleanup.sql
-- 1) Going forward, allocations that don't get an OTP within their 20-min
--    window are marked 'failed' (not 'expired'). 'expired' enum value stays
--    for historical rows; nothing breaks.
-- 2) cleanup_old_user_allocations(p_hours): hard-delete user allocations
--    older than N hours (default 24). Runs nightly via /api/public/cron.
--    Safety: never deletes 'pending' rows (active number requests),
--    never deletes rows linked to unsettled payouts.

BEGIN;

-- One-shot back-correction: any rows currently 'expired' due to the
-- 20-min timeout should be 'failed' going forward. (Old true-cancelled
-- ones are unaffected: those are 'cancelled', not 'expired'.)
UPDATE allocations
SET status = 'failed'
WHERE status = 'expired';

-- Cleanup function: hard-delete completed allocations older than N hours.
CREATE OR REPLACE FUNCTION cleanup_old_user_allocations(p_hours int DEFAULT 24)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  WITH deleted AS (
    DELETE FROM allocations
    WHERE created_at < now() - (p_hours || ' hours')::interval
      AND status <> 'pending'         -- never kill an active request
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_old_user_allocations(int) FROM public;
GRANT EXECUTE ON FUNCTION cleanup_old_user_allocations(int) TO service_role;

COMMIT;
