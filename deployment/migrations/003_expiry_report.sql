-- 003: Allocation expiry + daily report view
BEGIN;

-- Add expiry column (default 15 min from creation)
ALTER TABLE allocations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL
  DEFAULT (now() + interval '15 minutes');

-- Backfill any existing rows with NULL-ish defaults (no-op if already populated)
UPDATE allocations
SET expires_at = created_at + interval '15 minutes'
WHERE expires_at IS NULL;

-- Partial index so the expiry sweep is fast
CREATE INDEX IF NOT EXISTS idx_alloc_expires_pending
  ON allocations(expires_at) WHERE status = 'pending';

-- Daily aggregated report (read-only view for admin)
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

GRANT SELECT ON daily_report TO authenticated;
GRANT SELECT ON daily_report TO service_role;

COMMIT;
