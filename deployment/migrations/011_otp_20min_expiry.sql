-- 011: Number allocation expiry bumped 15min → 20min
-- Future allocations get the new default; in-flight pending ones get refreshed
-- so the user actually has up to 20 minutes after grabbing a number.
BEGIN;

ALTER TABLE allocations
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '20 minutes');

UPDATE allocations
SET expires_at = created_at + interval '20 minutes'
WHERE status = 'pending'
  AND expires_at < created_at + interval '20 minutes';

COMMIT;
