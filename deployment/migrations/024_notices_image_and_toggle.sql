-- Notice system upgrade: master on/off toggle + image_url + created_at index.
BEGIN;

ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS image_url text;

-- Master notice-system switch (global kill switch).
INSERT INTO app_settings (key, value, description, is_secret)
VALUES ('notices_enabled', 'true'::jsonb, 'Master switch for the notice/announcement system. false = hide all notices.', false)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_notices_created_at ON notices(created_at DESC);

COMMIT;
