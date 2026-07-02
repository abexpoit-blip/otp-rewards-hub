-- 022 · Switch upstream provider Stex → VoltxSMS and align rate structure.
--
-- What this migration does (idempotent):
--   1. Store VoltxSMS API base + key inside settings so no redeploy is needed.
--   2. Bump admin/agent caps and defaults:
--        default_payout         : 0.40 → 0.75  (fallback per-OTP payout)
--        default_user_rate      : new    0.60  (new user signups)
--        admin_agent_signup_rate: new    0.75  (users under admin@nexus.app)
--        max_agent_otp_rate     : 0.70 → 0.75  (per-agent hard cap)
--        max_user_otp_rate      : new    0.75  (per-user hard cap used by adminSetUserOtpRateFn)
--   3. Fix every existing agent account to the flat 0.75 BDT agent rate.
--
-- Safe to run multiple times.

INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('voltx_api_base',          to_jsonb('https://api.2oo9.cloud/MXS47FLFX0U/tnevs/@public/api'::text), false, 'VoltxSMS upstream API base URL'),
  ('voltx_api_key',           to_jsonb('M7Q6ZDUJWBG'::text), true,  'VoltxSMS upstream API key (mauthapi header)'),
  ('default_payout',          to_jsonb(0.75::numeric), false, 'Platform full payout per OTP (BDT). Agent commission = this - user otp_rate.'),
  ('default_user_rate',       to_jsonb(0.60::numeric), false, 'Default OTP rate for normal user signups (BDT).'),
  ('admin_agent_signup_rate', to_jsonb(0.75::numeric), false, 'Auto-approved user OTP rate when signing up under admin agent email (BDT).'),
  ('max_agent_otp_rate',      to_jsonb(0.75::numeric), false, 'Maximum agent OTP rate cap (BDT).'),
  ('max_user_otp_rate',       to_jsonb(0.75::numeric), false, 'Maximum user OTP rate cap (BDT).')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  is_secret = EXCLUDED.is_secret,
  description = EXCLUDED.description,
  updated_at = now();

-- Flatten every agent's own rate to the new fixed 0.75 BDT.
UPDATE users u
   SET otp_rate = 0.75
  FROM user_roles ur
 WHERE ur.user_id = u.id
   AND ur.role = 'agent'
   AND u.otp_rate <> 0.75;
