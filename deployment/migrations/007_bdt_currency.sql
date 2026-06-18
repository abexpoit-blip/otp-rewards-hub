-- ============================================================
-- 007_bdt_currency.sql
-- - OTP rate fixed at 0.04 BDT per successful OTP
-- - Min withdrawal 500 BDT
-- - Currency switched from USD to BDT (display-only; numbers unchanged)
-- ============================================================

-- 1) Update default payout in app_settings
UPDATE app_settings
SET value = '0.04'::jsonb,
    description = 'Fallback payout per successful OTP (BDT)'
WHERE key = 'default_payout';

-- Insert if missing
INSERT INTO app_settings (key, value, is_secret, description)
SELECT 'default_payout', '0.04'::jsonb, false, 'Fallback payout per successful OTP (BDT)'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'default_payout');

-- 2) Update existing service payouts that were at legacy 0.10 default → 0.04
UPDATE service_payouts SET amount = 0.04
WHERE amount = 0.10;

-- 3) Update payment gateways: min withdrawal = 500 BDT
UPDATE payment_gateways
SET min_amount = 500,
    max_amount = GREATEST(max_amount, 500000);

-- 4) Seed a default BDT gateway if none exist
INSERT INTO payment_gateways (code, name, enabled, min_amount, max_amount, fee_percent, fee_flat, auto_approve_under, instructions)
SELECT 'bKash', 'bKash (BDT)', true, 500, 100000, 0, 0, 0,
       'Send bKash Personal number. Payouts processed within 24 hours.'
WHERE NOT EXISTS (SELECT 1 FROM payment_gateways WHERE code = 'bKash');

INSERT INTO payment_gateways (code, name, enabled, min_amount, max_amount, fee_percent, fee_flat, auto_approve_under, instructions)
SELECT 'Nagad', 'Nagad (BDT)', true, 500, 100000, 0, 0, 0,
       'Send Nagad Personal number. Payouts processed within 24 hours.'
WHERE NOT EXISTS (SELECT 1 FROM payment_gateways WHERE code = 'Nagad');
