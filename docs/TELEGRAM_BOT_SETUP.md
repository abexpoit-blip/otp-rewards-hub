# Nexus X v2 — Telegram Bot Setup Guide

**English + বাংলা** — How to connect your Telegram bot to the Nexus X v2 OTP panel using our public REST API.

Base URL: `https://v2.nexus-x.site`

---

## 1. Get Your API Key / API Key নিন

**EN:** Log in to your **user account** (not admin/agent) at [v2.nexus-x.site](https://v2.nexus-x.site) → open **API Keys** page from the sidebar → click **Create Key** → copy the `nx_...` token immediately (shown only once).

**BN:** আপনার **user account** দিয়ে [v2.nexus-x.site](https://v2.nexus-x.site) এ login করুন (admin/agent দিয়ে হবে না) → sidebar থেকে **API Keys** পেজে যান → **Create Key** ক্লিক করুন → `nx_...` token টা সাথে সাথে copy করে রাখুন (একবারই দেখাবে)।

> ⚠️ Only `user` role accounts can create API keys. Admin/agent accounts → 403 error.
> শুধু **user** role এর account API key বানাতে পারবে। Admin/agent হলে 403 error আসবে।

---

## 2. Authentication / Authentication কীভাবে দিতে হবে

Every request needs this header:

```
Authorization: Bearer nx_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**BN:** প্রতিটা request এ উপরের মতো `Authorization` header দিতে হবে। কোন cookie/session লাগবে না — pure HTTP, তাই যেকোনো Telegram bot server থেকে সরাসরি call করা যাবে।

---

## 3. API Endpoints Overview

| Method | Endpoint | কাজ / Purpose |
|--------|----------|---------------|
| `GET`  | `/api/v1/balance` | Balance + per-OTP rate |
| `POST` | `/api/v1/numbers` | নতুন number allocate করা |
| `GET`  | `/api/v1/numbers?status=&limit=` | Recent allocations list |
| `GET`  | `/api/v1/numbers/:id` | একটা allocation এর status + সব OTP |
| `GET`  | `/api/v1/inbox?limit=&since=` | সব OTP unified inbox |

Full field spec: see [`BOT_API.md`](./BOT_API.md).

---

## 4. Field Names — service / access / sender / console

Different bots use different naming. আমরা **একই value** কয়েকটা alias এ পাঠাই যাতে কোনো bot এ change করতে না হয়।

| Concept / ধারণা | Aliases returned | Meaning / মানে |
|------------------|------------------|-----------------|
| **Service / App** | `service`, `access`, `sid` | কোন app এর জন্য number (whatsapp, telegram ইত্যাদি) |
| **Sender** | `sender` | SMS পাঠানো brand/number (যেমন `WhatsApp`)। unknown হলে `""` |
| **Full OTP text** | `body`, `text`, `full_text`, `console` | পুরো SMS message (OTP code সহ সব) |

**EN:** All four keys for OTP text hold the **exact same string** — pick whichever your bot code expects.
**BN:** OTP text এর জন্য চারটা key একই value ধরে রাখে — আপনার bot এ যেটা expect করে সেটা use করুন।

---

## 5. Quick Example — Python Telegram Bot

### 5.1 Allocate a Number / নতুন number নেওয়া

```python
import requests

API = "https://v2.nexus-x.site"
KEY = "nx_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
H = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

r = requests.post(f"{API}/api/v1/numbers", headers=H, json={
    "range": "bd-gp-wa",   # আপনার admin panel এ available range
    "sid":   "whatsapp",   # service tag
}).json()

alloc_id = r["id"]
number   = r["number"]
print("Got number:", number)
```

### 5.2 Poll OTP / OTP জন্য অপেক্ষা করা

```python
import time

while True:
    d = requests.get(f"{API}/api/v1/numbers/{alloc_id}", headers=H).json()
    if d["status"] == "success" and d["otps"]:
        otp = d["otps"][-1]
        service = d.get("service") or d.get("access") or d.get("sid")
        sender  = otp.get("sender", "")
        text    = otp.get("console") or otp.get("full_text") \
                  or otp.get("text") or otp.get("body", "")

        await bot.send_message(chat_id,
            f"📲 Number: {d['number']}\n"
            f"🔧 Service / Access: {service}\n"
            f"👤 Sender: {sender}\n"
            f"💬 Full SMS (console):\n{text}"
        )
        break
    if d["status"] in ("failed", "expired"):
        await bot.send_message(chat_id, f"❌ {d['status']}")
        break
    time.sleep(3)   # 3–5 sec interval recommended
```

### 5.3 Unified Inbox (all OTPs) / সব OTP একসাথে

```python
last_seen = None
while True:
    params = {"limit": 50}
    if last_seen: params["since"] = last_seen
    inbox = requests.get(f"{API}/api/v1/inbox", headers=H, params=params).json()
    for item in inbox["items"]:
        service = item.get("service") or item.get("access") or item.get("sid")
        sender  = item.get("sender", "")
        console = item.get("console") or item.get("full_text") \
                  or item.get("text") or item.get("body", "")
        await bot.send_message(chat_id,
            f"📲 {item['number']}\n🔧 {service}\n👤 {sender}\n💬 {console}")
        last_seen = item["received_at"]
    time.sleep(5)
```

---

## 6. Node.js / TypeScript Example

```ts
const API = "https://v2.nexus-x.site";
const KEY = process.env.NEXUS_API_KEY!;
const H   = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const alloc = await fetch(`${API}/api/v1/numbers`, {
  method: "POST", headers: H,
  body: JSON.stringify({ range: "bd-gp-wa", sid: "whatsapp" }),
}).then(r => r.json());

// poll
while (true) {
  const d = await fetch(`${API}/api/v1/numbers/${alloc.id}`, { headers: H }).then(r => r.json());
  if (d.status === "success" && d.otps.length) {
    const otp = d.otps.at(-1);
    const service = d.service ?? d.access ?? d.sid;
    const sender  = otp.sender ?? "";
    const console_ = otp.console ?? otp.full_text ?? otp.text ?? otp.body ?? "";
    await bot.sendMessage(chatId,
      `📲 ${d.number}\n🔧 ${service}\n👤 ${sender}\n💬 ${console_}`);
    break;
  }
  if (["failed","expired"].includes(d.status)) break;
  await new Promise(r => setTimeout(r, 3000));
}
```

---

## 7. Setup Checklist / Setup চেকলিস্ট

- [ ] User account (approved, not blocked/pending) আছে
- [ ] Balance আছে (allocation এর আগে check করুন `/api/v1/balance`)
- [ ] API Keys পেজ থেকে key তৈরি ও copy করেছেন
- [ ] Bot code এ `Authorization: Bearer nx_...` header set করেছেন
- [ ] `range` value সঠিক দিয়েছেন (admin panel এ available যেটা)
- [ ] Poll interval **3–5 sec** রেখেছেন (এর নিচে না)
- [ ] `service` / `access` / `sender` / `console` — যেকোনো alias use করুন

---

## 8. Common Errors / সাধারণ Error

| Status | Error | সমাধান |
|--------|-------|--------|
| `401` | Missing/malformed Authorization | Header format ঠিক করুন: `Bearer nx_...` |
| `401` | Invalid API key / revoked | নতুন key তৈরি করুন |
| `403` | Account blocked/pending | Admin এর কাছে approval নিন |
| `403` | API access is available to user accounts only | User account দিয়ে key বানান |
| `409` | Out of stock | অন্য range try করুন |
| `502` | Upstream allocation failed | কিছুক্ষণ পরে retry করুন |

---

## 9. Support / সাহায্য

- Telegram: **@samexpoit**
- Auto-approval agent email: `admin@nexus.app`
- Full API reference: [`docs/BOT_API.md`](./BOT_API.md)

**Happy botting! 🚀 — Nexus X v2 Team**
