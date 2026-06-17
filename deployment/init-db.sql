-- Run once inside nexus_db Postgres container to create v2 database + user.
-- Usage (VPS theke):
--   docker exec -i nexus_db psql -U $POSTGRES_USER -d postgres < deployment/init-db.sql

CREATE USER nexus_v2 WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE nexus_v2 OWNER nexus_v2;
GRANT ALL PRIVILEGES ON DATABASE nexus_v2 TO nexus_v2;
