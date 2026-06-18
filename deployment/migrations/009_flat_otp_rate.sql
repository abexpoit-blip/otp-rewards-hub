-- 009: Flat OTP rate — every successful OTP pays ৳0.40 BDT
-- Removes per-service overrides; all payouts use default_payout.

UPDATE app_settings
SET value = '0.40'::jsonb, updated_at = now()
WHERE key = 'default_payout';

INSERT INTO app_settings (key, value, is_secret, description)
SELECT 'default_payout', '0.40'::jsonb, false, 'Flat payout per successful OTP (BDT)'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'default_payout');

-- Disable all per-service overrides so the flat rate applies everywhere.
UPDATE service_payouts SET active = false;
