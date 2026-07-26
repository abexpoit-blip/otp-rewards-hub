-- 026 · Switch upstream provider VoltxSMS → ZENEX NETWORK (Core API v4).
--
-- Only the upstream transport changes. Rates, payouts, commission flow,
-- allocations and UI stay exactly as-is.
--
-- Keys read by src/lib/stex.server.ts (first match wins):
--   zenex_api_base / zenex_api_key  → voltx_* → stex_*
--
-- Safe to run multiple times.

INSERT INTO app_settings (key, value, is_secret, description) VALUES
  ('zenex_api_base', to_jsonb('https://api.zenexnetwork.com/v1'::text), false, 'Zenex Network upstream API base URL'),
  ('zenex_web_base', to_jsonb('https://zenexnetwork.com'::text),        false, 'Zenex Network web base (live console feed)'),
  ('zenex_api_key',  to_jsonb('ZNX_GIM8BAXP0K9T7VNZKZBPLNR5'::text),    true,  'Zenex Network API key (mapikey header)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  is_secret = EXCLUDED.is_secret,
  description = EXCLUDED.description,
  updated_at = now();

SELECT key, updated_at FROM app_settings WHERE key LIKE 'zenex_%';
