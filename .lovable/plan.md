
# Phase 1 — Backend Foundation (Auth + Database)

ভালো খবর: আপনার TanStack Start app ই backend handle করতে পারবে — আলাদা API container লাগবে না। এতে deployment অনেক simple, existing nginx config পরিবর্তন লাগবে না।

## Architecture (simple)

```
Browser → nginx (v2.nexus-x.site) → nexus_v2_app (TanStack Start)
                                       ├─ React UI
                                       └─ /api/* server routes  ─→ nexus_db (Postgres, nexus_v2 database)
                                                                  └─ stex API (Phase 2)
```

- ✅ Existing `nexus_db` Postgres reuse (DB `nexus_v2` already init-db.sql এ define করা)
- ✅ Existing nginx route already correct
- ✅ শুধু `nexus_v2_app` rebuild + push — no new container

## এই Phase এ যা হবে

### 1. Database schema (`deployment/migrations/001_init.sql`)

8টা table grants + RLS-free (we control access in code):
- `users` — id, email, password_hash, name, phone, balance, lifetime_earning, status (active/blocked), created_at, last_login_at
- `user_roles` — separate table, enum `app_role` (user/teamlead/admin), `has_role()` helper
- `sessions` — login history (id, user_id, ip, ua, created_at)
- `announcements` — admin global banner (id, message, severity, active, created_at)
- `ranges` — cached from stex liveaccess (sender_id, range_pattern, country, operator, last_seen_at)
- `allocations` — number requests (id, user_id, rid, full_number, country, operator, status: pending/success/failed/expired, stex_response, created_at)
- `otp_messages` — incoming OTPs (id, allocation_id, sender, body, received_at)
- `withdrawals` — id, user_id, amount, gateway, address, status (pending/approved/rejected), tx_id, admin_note, created_at, processed_at
- `api_keys` — id, user_id, key_hash, label, last_used_at, revoked_at

Plus migration runner: `deployment/migrations/run.sh`

### 2. Backend packages
```
bun add postgres bcryptjs jsonwebtoken zod
bun add -D @types/bcryptjs @types/jsonwebtoken
```

### 3. Server-side files
- `src/lib/db.server.ts` — postgres-js client (singleton, reads `DATABASE_URL`)
- `src/lib/jwt.server.ts` — sign/verify JWT (reads `JWT_SECRET`)
- `src/lib/password.server.ts` — bcrypt hash/compare
- `src/lib/auth.functions.ts` — `signupFn`, `loginFn`, `meFn`, `logoutFn` (createServerFn)
- `src/routes/api/health.ts` — `GET /api/health` (DB ping)

### 4. Frontend rewrite
- `src/lib/auth.tsx` — REST fetch বাদ দিয়ে `useServerFn(loginFn)` etc use করব
- `src/routes/login.tsx` / `signup.tsx` — existing form behaviour same থাকবে, just calls change

### 5. Deployment files
- `.env.example` — `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET` (stex API key Phase 2 এ add হবে)
- `deployment/migrations/run.sh` — script that runs all `*.sql` in order against `nexus_db`
- `Dockerfile` — ensure env vars passed at runtime

### 6. First-admin seed
`deployment/seed-admin.sql` — আপনার email কে admin role দেওয়ার জন্য একটা manual SQL (signup করার পর run করবেন)

## Phase 1 শেষে যা কাজ করবে

- ✅ `/signup` real account create করবে (Postgres এ user row)
- ✅ `/login` JWT issue করবে, localStorage এ save হবে
- ✅ Dashboard load হলে `meFn` call → token validate → user info show
- ✅ Logout → token clear
- ✅ Admin role check function ready (Phase 3 admin panel এর জন্য)
- ✅ Database প্রস্তুত — Phase 2 এ stex integration বসবে

## যা Phase 1 এ হবে না (পরের phase)

- Phase 2: stex API integration, Get Number page (real numbers), Live Console (real OTPs), Summary stats
- Phase 3: Withdrawal flow, Payment addresses, API key generation
- Phase 4: Admin panel (user/range/withdrawal/announcement management)

## Deploy commands (Phase 1 শেষে যা চালাবেন)

```bash
# এক বার: migration apply
cd /opt/nexus-v2 && git pull
docker exec -i nexus_db sh -c 'psql -U "$POSTGRES_USER" -d nexus_v2' < deployment/migrations/001_init.sql

# তারপর প্রতি bার:
docker compose -f deployment/docker-compose.yml up -d --build nexus_v2_app
docker logs --tail 80 nexus_v2_app
```

প্রতিটা backend change এর সাথে আমি exact command দিব।

---

**Approve করলে এখনই Phase 1 build শুরু করছি।** Stex API key Phase 2 এ লাগবে — তখন আপনাকে VPS এর `.env` এ add করতে বলব।
