-- 017_agent_commission.sql
-- Full payout cap = 0.70 BDT. Agent earns (0.70 - user_otp_rate) per successful OTP
-- credited to their own users.balance + lifetime_earning.
-- Also record commission on allocations for audit.

BEGIN;

-- Raise default_payout to the platform full rate (0.70). Agents/users use per-user otp_rate;
-- this value is the ceiling used for agent commission math.
UPDATE app_settings SET value = '0.70'::jsonb WHERE key = 'default_payout';
INSERT INTO app_settings (key, value, is_secret, description)
SELECT 'default_payout', '0.70'::jsonb, false, 'Platform full payout per OTP (BDT). Agent commission = this - user otp_rate.'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'default_payout');

-- Track per-OTP agent commission on allocations (nullable; 0 when no agent).
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS agent_commission numeric(10,4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS allocations_agent_idx ON allocations(agent_id) WHERE agent_id IS NOT NULL;

COMMIT;
