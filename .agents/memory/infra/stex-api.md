---
name: stex SMS provider API
description: Upstream OTP number provider — base URL, auth header, endpoints, reseller integration model
type: feature
---

# stex SMS — Provider API (Phase 2 integration)

**Base URL:** `https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api`
**Auth header:** `mauthapi: <API_KEY>` (one admin/reseller key for the whole panel)
**Account:** samexpoit@gmail.com (panel: https://stexsms.com/m29/)
**Model:** Reseller — single admin key powers all panel users. Admin enables "API access" in stex Profile, then generates the key.

## Response envelope
```json
{ "meta": {"code":200,"status":"ok"}, "data": {...}, "message": "...", "rid": "..." }
```
- Success: `meta.code = 200`
- Out of stock: `meta.code = 2946`, `status = "not_found"`, `data = null`

## Endpoints

### POST /getnum
Allocate one number from a range.
- Body: `{ "rid": "26134" }`  (range digits without trailing XXX, OR a search-mode range_id)
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
- Stale allocations time out after N minutes (app logic)
