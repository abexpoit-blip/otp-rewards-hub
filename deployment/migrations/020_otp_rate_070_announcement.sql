-- Nexus V2 — migration 020: OTP rate increase 0.60 → 0.70 announcement
-- Inserts a popup + banner notice. Branded popup header (Nexus 2.0 logo)
-- is rendered by NoticeBanner.tsx automatically.
--
-- Run:
--   docker exec -i nexus_db psql -U nexus_v2 nexus_v2 < deployment/migrations/020_otp_rate_070_announcement.sql

BEGIN;

-- Deactivate older rate announcements so only the latest shows
UPDATE notices
SET active = false, updated_at = now()
WHERE active = true
  AND (title ILIKE '%OTP Rate%' OR body ILIKE '%OTP payout rate%');

-- Popup (shows once per device — handled by client localStorage)
INSERT INTO notices (type, priority, audience, title, body, active)
VALUES (
  'popup',
  'info',
  'both',
  '🎉 OTP Rate Increased to ৳0.70!',
  E'Great news from Nexus 2.0!\n\nWe have increased the OTP payout rate from ৳0.60 to ৳0.70 BDT per successful OTP.\n\nAnd this is just the beginning — rates will keep going up day by day.\n\nStay with us and keep earning more! 🚀',
  true
);

-- Persistent top banner
INSERT INTO notices (type, priority, audience, title, body, active)
VALUES (
  'banner',
  'info',
  'both',
  'OTP Rate is now ৳0.70 BDT (up from ৳0.60) — rates will keep increasing. Stay with Nexus 2.0! 🚀',
  '',
  true
);

COMMIT;
