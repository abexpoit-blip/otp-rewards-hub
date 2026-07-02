-- 025 · Lower global minimum withdrawal from 500 to 250 BDT.
-- Admin can still change it live from /admin/settings; this just resets the default.

UPDATE app_settings
   SET value = to_jsonb(250::numeric),
       description = 'Global minimum withdrawal amount (BDT)',
       updated_at = now()
 WHERE key = 'min_withdraw';

INSERT INTO app_settings (key, value, is_secret, description)
SELECT 'min_withdraw', to_jsonb(250::numeric), false, 'Global minimum withdrawal amount (BDT)'
 WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'min_withdraw');

-- Also relax any gateway rows still stuck at 500 minimum.
UPDATE payment_gateways
   SET min_amount = 250
 WHERE min_amount = 500;
