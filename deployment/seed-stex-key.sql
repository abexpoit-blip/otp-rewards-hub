-- Seed / rotate STEX reseller API key into app_settings.
-- Usage on VPS:
--   docker exec -i nexus_db psql -U nexus_v2 -d nexus_v2 < deployment/seed-stex-key.sql
--
-- After this runs, settings cache invalidates within ~15s and all STEX calls
-- (poller, getnum, success-otp, console, liveaccess) start using this key.
-- To rotate later: edit the value below, or use Admin → Settings UI.

UPDATE app_settings
   SET value = '"M3I80NVNITQ"'::jsonb,
       updated_at = now()
 WHERE key = 'stex_api_key';

SELECT key, value, updated_at FROM app_settings WHERE key = 'stex_api_key';
