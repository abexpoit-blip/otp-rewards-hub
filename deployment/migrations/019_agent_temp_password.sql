-- 019: Force agents to change the admin-issued temporary password on first login.
-- Adds a flag and sets it true for newly created agents (admin.functions sets it on insert).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.must_change_password IS
  'TRUE when password was set by an admin (e.g. agent provisioning). User must set their own password before continuing.';
