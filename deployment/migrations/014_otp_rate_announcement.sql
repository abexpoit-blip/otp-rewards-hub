-- Nexus V2 — migration 014: OTP rate increase announcement
-- Inserts a popup + banner notice announcing OTP rate is now 0.60 BDT.
--
-- Run:
--   docker exec -i nexus_db psql -U nexus_v2 nexus_v2 < deployment/migrations/014_otp_rate_announcement.sql

BEGIN;

-- Popup (shows once per device — handled by client localStorage)
INSERT INTO notices (type, priority, title, body, active)
VALUES (
  'popup',
  'info',
  '🎉 OTP Rate Increased to ৳0.60!',
  E'Great news from Nexus 2.0!\n\nWe have increased the OTP payout rate to ৳0.60 BDT per successful OTP.\n\nAnd this is just the beginning — rates will keep going up day by day.\n\nStay with us and keep earning more! 🚀',
  true
);

-- Persistent banner at the top of every page
INSERT INTO notices (type, priority, title, body, active)
VALUES (
  'banner',
  'info',
  'OTP Rate is now ৳0.60 BDT — rates will increase day by day. Stay with Nexus 2.0! 🚀',
  '',
  true
);

COMMIT;
