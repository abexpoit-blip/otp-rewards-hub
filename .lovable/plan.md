
# Nexus SMS v2 — Full Panel Build Plan

Stex SMS v4 এর সব feature নিয়ে একটা production-ready OTP/SMS dialer panel বানাব। তোমার নিজের site, তাই design + flow ১:১ match করব, কিন্তু code পুরো নিজের লেখা — তোমার own brand হিসেবে।

---

## Phase 1 — Foundation & Design System

**Goal:** Stex এর exact look & feel + theme switcher

- Dark theme (default) + Light mode
- 7 accent colors: Mint (default), Purple, Pink, Orange, Blue, Yellow, Rainbow
- Monospace font for numbers/codes, clean sans for body
- Glassmorphism dark cards, soft glow, rounded corners
- Sidebar (expandable/collapsible) + top search bar + clock (UTC+0)
- Density toggle (Comfortable/Compact)
- Privacy mode (mask numbers with •••)
- All settings persist in localStorage

**Files:** `src/styles.css` (tokens), `src/components/AppSidebar.tsx`, `src/components/TopBar.tsx`, `src/components/TweaksPanel.tsx`, `src/routes/__root.tsx`

---

## Phase 2 — Authentication

- **Login** — Email + Password, Remember me, Forgot password link
- **Register** — Create Account (email/password/name/phone)
- **Forgot Password** — Email reset flow
- **Reset Password** — `/reset-password` page
- **2-Step (OTP)** — Optional for Login + Payment (toggle in Profile)
- Session tracking (last 4 sessions: time, IP, device)

**Backend:** Lovable Cloud auth + `profiles` table + `user_roles` table (user/teamlead/admin)

---

## Phase 3 — Dialer Panel (6 pages)

### 1. Dashboard
- Welcome banner with user name
- Announcement banner (admin-editable)
- 4 stat cards: Today Revenue, Today OTPs, Yesterday Revenue, Yesterday OTPs
- Hourly Traffic live line chart (24h)
- Top Performers table (service/volume/earnings)
- Global Trending apps list (Top 10 with sparklines)

### 2. Get Number
- 3 modes: **Range** / **Search** / **Access**
- Prefix input (e.g. `88017XXX`), National Format + Remove (+) toggle
- Sync Mode switch
- Allocated numbers list with Success/Failed/Pending tabs + counter
- Success rate %, refresh button
- Number info, country/operator, activity columns

### 3. Live Console
- Top Apps bar chart (real-time top 4)
- Carrier Distribution donut chart
- Live streaming OTP feed (max 50 messages):
  - Timestamp, carrier badge, country, sender, masked number, full SMS body
- Filter logs by sender/operator
- Auto-refresh countdown ("Next update: 2s")

### 4. Summary
- Date range picker (Last 7/30/90 days, custom)
- 4 cards: Total Allocation, Success Rate, Total Earnings, Total Success
- Success vs Failed trend chart (line)
- Earnings Overview chart (area)
- Detailed daily report table + CSV download

### 5. Access List
- "Coming Soon" page (Team Lead contact CTA) — same as original

### 6. Sender / Range
- Searchable table (Sender ID + Range like `12Go → 2011XXX`)
- Pagination (First / Prev / Next / Last)
- Result counter
- Admin can bulk-import via CSV

---

## Phase 4 — Account (3 pages)

### 7. Profile
- Welcome card (name, last login, member since, public UID, lifetime earning)
- Personal info form: First/Last name, Bio, Country, City, Birth date, Timezone, Address, Telegram username
- Email + Phone (read-only, verified badges)
- Notification channel (Email/Telegram/SMS) + enable toggle
- Security: 2-Step Login toggle, 2-Step Payment toggle
- API Keys: Generate/Revoke (gated by Team Lead approval)
- Sessions log (last 4)
- Save Changes requires OTP confirm

### 8. Payment
- Payment notices & limits (admin-editable cards e.g. "USDT SOL Network — Min $0.5, Max $500")
- Available Balance (large display)
- Payment Addresses: Add new (gateway dropdown — USDT/Binance Pay/bKash/Nagad etc.) + saved list
- Withdraw form: Address picker + Amount (multiples of $0.50) + "Use max" + Withdraw Now button
- History table: Date, Method, Details, Amount, TX ID, Status (Pending/Approved/Rejected)

### 9. Logout — clear session + redirect

---

## Phase 5 — Admin Panel (separate `/admin` routes, role-gated)

- **Users:** List, search, block/unblock, approve API key, assign Team Lead, balance adjust
- **Ranges:** Upload CSV (Sender ID + Range), edit, delete, assign to user/group
- **Withdrawals:** Approve/Reject queue, TX ID input
- **Announcements:** Edit dashboard banner
- **Payment Gateways:** Add/edit gateways and limits
- **Analytics:** Platform-wide stats

---

## Phase 6 — Backend (Lovable Cloud)

**Tables (all with RLS + GRANTs):**
- `profiles` — user info, settings, balance, lifetime_earning
- `user_roles` — separate roles table (user/teamlead/admin) with `has_role()` function
- `ranges` — sender_id, range pattern, country, operator, status
- `range_assignments` — user_id ↔ range_id
- `allocations` — user requested ranges (active/expired)
- `otp_messages` — incoming SMS stream (number, sender, body, carrier, country, timestamp)
- `payment_addresses` — user wallets/accounts
- `withdrawals` — request, amount, status, tx_id, admin_note
- `announcements` — global banner
- `payment_gateways` — admin config
- `sessions_log` — login history
- `api_keys` — hashed, per-user

**Realtime:** OTP stream (Live Console) + Withdrawal status

**Edge function / Server route:** Public webhook endpoint at `/api/public/otp-ingest` for the SMS gateway to POST incoming messages (HMAC-signed)

---

## Phase 7 — Deploy (VPS)

প্রতি phase শেষে exact deploy command দেব। Final flow:

```bash
cd /opt/nexus-v2 && \
git stash && git pull && \
docker compose -f deployment/docker-compose.yml up -d --build nexus_v2_app && \
docker logs -f --tail 50 nexus_v2_app
```

---

## Build Order (recommendation)

আমি **Phase 1 → 2 → 3 → 4 → 5 → 6** এই order এ যাব। প্রতিটা phase শেষে preview দেখতে পারবে + VPS এ push command পাবে।

**Total estimate:** ~6-8 build rounds (প্রতি phase = 1-2 round)

---

## Questions before starting:

1. **Brand name** — "Nexus SMS" / "Nexus Panel" / অন্য কিছু? (Stex SMS logo replace করতে হবে)
2. **Default accent** — Mint green রাখব নাকি অন্য?
3. **Webhook source** — কোন SMS gateway থেকে OTP আসবে? (এটা Phase 6 এ লাগবে, এখন না বললেও চলবে)

Approve করলে **Phase 1 (Foundation + Design System + Sidebar + Tweaks panel)** দিয়ে শুরু করব।
