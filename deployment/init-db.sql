-- Run safely/repeatedly inside nexus_db Postgres container to create v2 database + user.
-- Usage (VPS theke):
--   docker exec -i nexus_db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < deployment/init-db.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexus_v2') THEN
    CREATE ROLE nexus_v2 LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  ELSE
    ALTER ROLE nexus_v2 WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END
$$;

SELECT 'CREATE DATABASE nexus_v2 OWNER nexus_v2'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'nexus_v2')\gexec

ALTER DATABASE nexus_v2 OWNER TO nexus_v2;
GRANT ALL PRIVILEGES ON DATABASE nexus_v2 TO nexus_v2;
