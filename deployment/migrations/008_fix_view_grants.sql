-- 008: Fix daily_report view — remove Supabase-only GRANTs that crash on self-hosted Postgres.
-- Migration 003 had `GRANT ... TO authenticated` / `service_role` which don't exist here.
-- This migration recreates the view cleanly. Idempotent.
BEGIN;

CREATE OR REPLACE VIEW daily_report AS
SELECT
  created_at::date                                                AS day,
  COUNT(*)::int                                                   AS total_allocations,
  COUNT(*) FILTER (WHERE status = 'success')::int                 AS success,
  COUNT(*) FILTER (WHERE status = 'expired')::int                 AS expired,
  COUNT(*) FILTER (WHERE status = 'failed')::int                  AS failed,
  COUNT(*) FILTER (WHERE status = 'pending')::int                 AS pending,
  COALESCE(SUM(payout_amount) FILTER (WHERE status = 'success'),0)::numeric(12,2)
                                                                  AS payout_total,
  COUNT(DISTINCT user_id)::int                                    AS active_users
FROM allocations
GROUP BY created_at::date
ORDER BY day DESC;

COMMIT;
