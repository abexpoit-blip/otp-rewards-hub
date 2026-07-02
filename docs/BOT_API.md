# Nexus X v2 — Public Bot API (`/api/v1/*`)

Base URL: `https://v2.nexus-x.site`

## Authentication

Every request must include a **user-role** API key:

```
Authorization: Bearer nx_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Rules:
- Only `role = user` accounts can create/use API keys. Admin/agent accounts get `403`.
- Blocked accounts → `403 Account blocked`. Pending accounts → `403 Account pending approval`.
- Revoked keys → `401 API key revoked`.
- CORS: `*` allowed, `OPTIONS` preflight supported — Telegram bots (server-side) don't need CORS, but the browser-based inspector will work too.

Errors always return JSON: `{ "ok": false, "error": "<message>" }` with an appropriate HTTP status (400/401/403/404/409/500/502).

---

## Field naming (why so many aliases?)

Different Telegram bots use different key names. Every OTP/allocation response includes the same value under multiple aliases so any bot works out-of-the-box:

| Concept                | Aliases returned                          | Meaning                                                    |
|------------------------|-------------------------------------------|------------------------------------------------------------|
| Service / App          | `service`, `access`, `sid`                | The service the number is used for (e.g. `whatsapp`, `telegram`, upstream sid). |
| Sender                 | `sender`                                  | SMS originator string (brand name or number). `""` if unknown. |
| Full OTP text          | `body`, `text`, `full_text`, `console`    | The complete SMS text — including the OTP code and any surrounding message. |

All fields are **always present** (never `undefined`). Unknown strings are `""`, unknown foreign keys/scalars are `null`.

---

## GET `/api/v1/balance`

Returns the account balance and per-OTP rate.

```json
{
  "ok": true,
  "email": "user@example.com",
  "balance": 152.35,
  "lifetime_earning": 987.10,
  "otp_rate": 0.70,
  "currency": "BDT"
}
```

---

## POST `/api/v1/numbers`

Allocate a new phone number.

Request body:
```json
{ "range": "bd-gp-wa", "sid": "whatsapp", "national": false, "no_plus": false }
```

Response `201`:
```json
{
  "ok": true,
  "id": "b1c9…-uuid",
  "number": "+8801XXXXXXXXX",
  "full_number": "+8801XXXXXXXXX",
  "national_number": "01XXXXXXXXX",
  "no_plus_number": "8801XXXXXXXXX",
  "country": "BD",
  "operator": "GP",
  "status": "pending",
  "service": "whatsapp",
  "access":  "whatsapp",
  "sid":     "whatsapp",
  "created_at": "2026-07-02T10:20:00.000Z",
  "expires_at": "2026-07-02T10:40:00.000Z"
}
```

Errors: `409 Out of stock`, `502 Upstream allocation failed`.

---

## GET `/api/v1/numbers?status=pending|success|failed|expired&limit=50`

List recent allocations for this API key's account.

```json
{
  "ok": true,
  "count": 2,
  "items": [
    {
      "id": "b1c9…",
      "number": "+8801…",
      "full_number": "+8801…",
      "national_number": "01…",
      "no_plus_number": "8801…",
      "country": "BD",
      "operator": "GP",
      "status": "success",
      "service": "whatsapp",
      "access":  "whatsapp",
      "sid":     "whatsapp",
      "payout": 0.70,
      "created_at": "2026-07-02T10:20:00.000Z",
      "completed_at": "2026-07-02T10:21:12.000Z",
      "expires_at":   "2026-07-02T10:40:00.000Z"
    }
  ]
}
```

`limit` clamped to `1..200`. Invalid `status` values are ignored (returns all).

---

## GET `/api/v1/numbers/:id`

Poll a single allocation and receive every OTP delivered for it. Recommended poll interval: **3–5 s** until `status === "success"`.

```json
{
  "ok": true,
  "id": "b1c9…",
  "number": "+8801…",
  "full_number": "+8801…",
  "national_number": "01…",
  "no_plus_number": "8801…",
  "country": "BD",
  "operator": "GP",
  "status": "success",
  "service": "whatsapp",
  "access":  "whatsapp",
  "sid":     "whatsapp",
  "payout": 0.70,
  "created_at":  "2026-07-02T10:20:00.000Z",
  "completed_at":"2026-07-02T10:21:12.000Z",
  "expires_at":  "2026-07-02T10:40:00.000Z",
  "otps": [
    {
      "id": "…",
      "sender": "WhatsApp",
      "body":      "Your WhatsApp code: 123-456. Don't share.",
      "text":      "Your WhatsApp code: 123-456. Don't share.",
      "full_text": "Your WhatsApp code: 123-456. Don't share.",
      "console":   "Your WhatsApp code: 123-456. Don't share.",
      "received_at": "2026-07-02T10:21:12.000Z"
    }
  ]
}
```

---

## GET `/api/v1/inbox?limit=50&since=<ISO-8601>`

Unified inbox — all OTPs across all allocations. Use `since` for incremental sync.

```json
{
  "ok": true,
  "count": 1,
  "items": [
    {
      "id": "…",
      "allocation_id": "b1c9…",
      "number": "+8801…",
      "sender": "WhatsApp",
      "service": "whatsapp",
      "access":  "whatsapp",
      "sid":     "whatsapp",
      "body":      "Your WhatsApp code: 123-456. Don't share.",
      "text":      "Your WhatsApp code: 123-456. Don't share.",
      "full_text": "Your WhatsApp code: 123-456. Don't share.",
      "console":   "Your WhatsApp code: 123-456. Don't share.",
      "country":  "BD",
      "operator": "GP",
      "payout": 0.70,
      "received_at": "2026-07-02T10:21:12.000Z"
    }
  ]
}
```

---

## Telegram bot mapping cheatsheet

```python
# Any of these key names works — they all point to the same value.
service = item.get("service") or item.get("access") or item.get("sid")
sender  = item.get("sender", "")
otp_txt = item.get("console") or item.get("full_text") or item.get("text") or item.get("body", "")

await bot.send_message(
    chat_id,
    f"📲 {item['number']}\n"
    f"🔧 Service: {service}\n"
    f"👤 Sender:  {sender}\n"
    f"💬 {otp_txt}"
)
```

No special role/scope is needed — just a valid user API key in the `Authorization` header. The endpoints are public HTTP (no session cookie, no CSRF) so a Telegram bot running on any server can call them without hitting an authorization error.
