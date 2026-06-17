---
name: stex SMS provider API
description: Upstream OTP number provider — base URL, auth header, endpoints, reseller integration model, live API key
type: feature
---

# stex SMS — Provider API

**Base URL:** `https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api`
**Auth header:** `mauthapi: <API_KEY>` (one admin/reseller key for the whole panel)
**Account:** samexpoit@gmail.com / Shovon@2013 (panel: https://stexsms.com/m29/)
**API docs page:** https://stexsms.com/m29/#/doc/api
**Live API key (reseller, as of 2026-06-17):** `M3I80NVNITQ`
- Verified working against `/liveaccess` (200 ok).
- Stored in `app_settings.stex_api_key` (DB). Rotate via Admin → Settings UI, or run `deployment/seed-stex-key.sql`.
- Note: STEX profile UI labels it as `Authorization` header, but the official API doc and verified behavior use the `mauthapi` header. Use `mauthapi`.

**Model:** Reseller — single admin key powers all panel users. Admin enables "API access" in stex Profile, then generates the key (Reveal / Copy / Regenerate / Revoke on the Profile page).

## Response envelope
```json
{ "meta": {"code":200,"status":"ok"}, "data": {...}, "message": "...", "rid": "..." }
```
- Success: `meta.code = 200`
- Out of stock: `meta.code = 2946`, `status = "not_found"`, `data = null`

## Endpoints (paths are appended to BASE above)

### POST /getnum
Allocate one number from a range.
- Body: `{ "rid": "26134" }`  (range digits WITHOUT trailing XXX, OR a search-mode range_id)
- data: `{ full_number, national_number, no_plus_number, country, operator }`

### GET /liveaccess  (cached 60s, same response per caller)
Recently-active services + the ranges each one hit. Use to populate range picker UI.
- data: `{ cached, services: [{ sid, last_at, ranges: [...] }] }`

### GET /success-otp  (cached 5s per user)
The caller's last 50 successful OTPs.
- data: `{ cached, otps: [{ otp_id, number, message, time }] }`
- `otp_id` = number + time(ms); `time` = unix ms

### GET /console  (cached 5s, global)
Global live feed of recent hits, last 15 min, console-hide rules applied.
- data: `{ cached, hits: [{ range, sid, message, time }] }`

## No endpoint for: release/cancel number, balance check, list ranges
- Strategy: poll `/success-otp` after `/getnum` to detect OTP arrival
- Stale allocations time out after N minutes (app logic — `expire_minutes` in app_settings)
