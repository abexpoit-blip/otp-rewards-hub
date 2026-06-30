-- 021: Relax agent profile completion to 80% (4 of 5 required fields)
-- so agents can start approving users sooner.
--
-- Run:
--   docker exec -i nexus_db psql -U nexus_v2 nexus_v2 < deployment/migrations/021_agent_profile_relax_and_admin_auto.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.is_agent_profile_complete(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (
    (CASE WHEN COALESCE(NULLIF(btrim(name),''),           NULL) IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(NULLIF(btrim(phone),''),          NULL) IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(NULLIF(btrim(telegram),''),       NULL) IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(NULLIF(btrim(personal_email),''), NULL) IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(NULLIF(btrim(address),''),        NULL) IS NOT NULL THEN 1 ELSE 0 END)
  ) >= 4
  FROM users WHERE id = _uid;
$$;

COMMIT;
