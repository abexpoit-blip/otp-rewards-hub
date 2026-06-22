-- 018_agent_profile.sql
-- Agent profile completion: agents must fill personal details before they
-- can approve users under them.
--
-- Run:
--   docker exec -i nexus_db psql -U nexus_v2 nexus_v2 < deployment/migrations/018_agent_profile.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address          text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_link       text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_profile_completed_at timestamptz;

-- Setting: domain used when admin creates an agent by username.
INSERT INTO app_settings (key, value, is_secret, description)
VALUES ('agent_email_domain', '"v2.nexus-x.site"'::jsonb, false,
        'Domain auto-appended to agent username when admin creates an agent.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_agent_profile_complete(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
     WHERE id = _uid
       AND COALESCE(NULLIF(btrim(name),''), NULL) IS NOT NULL
       AND COALESCE(NULLIF(btrim(phone),''), NULL) IS NOT NULL
       AND COALESCE(NULLIF(btrim(telegram),''), NULL) IS NOT NULL
       AND COALESCE(NULLIF(btrim(personal_email),''), NULL) IS NOT NULL
       AND COALESCE(NULLIF(btrim(address),''), NULL) IS NOT NULL
  );
$$;

COMMIT;
