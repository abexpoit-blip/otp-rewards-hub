-- 023: Add allocation-level OTP audit fields used by status checks.
--
-- Older installs only stored OTP delivery time/message in otp_messages.
-- We now mirror the first matched OTP onto allocations so admin checks can
-- directly confirm: OTP received → allocation success → payout credited.
--
-- Safe to run multiple times.

BEGIN;

ALTER TABLE allocations
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_code text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_payout numeric(18,4) NOT NULL DEFAULT 0;

-- Backfill allocations that already have matched OTP messages.
UPDATE allocations a
SET received_at = COALESCE(a.received_at, m.received_at),
    otp_code = COALESCE(a.otp_code, COALESCE(substring(m.body from '([0-9]{4,8})'), m.body)),
    settled_at = COALESCE(a.settled_at, a.completed_at),
    user_payout = CASE WHEN a.user_payout = 0 THEN a.payout_amount ELSE a.user_payout END
FROM LATERAL (
  SELECT om.body, om.received_at
  FROM otp_messages om
  WHERE om.allocation_id = a.id
     OR (om.user_id = a.user_id AND om.received_at >= a.created_at - interval '2 minutes' AND (
          regexp_replace(COALESCE(om.number,''), '\D','','g') = regexp_replace(COALESCE(a.full_number,''), '\D','','g')
       OR regexp_replace(COALESCE(om.number,''), '\D','','g') = regexp_replace(COALESCE(a.no_plus_number,''), '\D','','g')
       OR regexp_replace(COALESCE(om.number,''), '\D','','g') = regexp_replace(COALESCE(a.national_number,''), '\D','','g')
       OR (regexp_replace(COALESCE(a.national_number,''), '\D','','g') <> ''
           AND regexp_replace(COALESCE(om.number,''), '\D','','g') LIKE '%' || regexp_replace(COALESCE(a.national_number,''), '\D','','g'))
     ))
  ORDER BY om.received_at ASC
  LIMIT 1
) m
WHERE (a.received_at IS NULL OR a.otp_code IS NULL OR a.settled_at IS NULL OR a.user_payout = 0);

CREATE INDEX IF NOT EXISTS idx_alloc_received_at ON allocations(received_at DESC) WHERE received_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alloc_success_received ON allocations(status, received_at DESC) WHERE received_at IS NOT NULL;

COMMIT;