-- Promote a signed-up user to admin role.
-- Usage (signup করার পর VPS এ এক বার চালান):
--   1. আগে browser এ /signup করে account বানান (e.g. samexpoit@gmail.com)
--   2. তারপর VPS এ:
--      docker exec -i nexus_db psql -U nexus_v2 -d nexus_v2 \
--        -v email="'samexpoit@gmail.com'" < deployment/seed-admin.sql

INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM users WHERE email = :email
ON CONFLICT (user_id, role) DO NOTHING;

SELECT u.email, ur.role
FROM users u JOIN user_roles ur ON ur.user_id = u.id
WHERE u.email = :email;
