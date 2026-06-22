# Agent System — Plan

Boro change, ektu boro plan. Approve korle build shuru korbo.

## 1. Agent (sub-admin) role

- Notun role `agent` add hobe (`user_roles` enum-e).
- Current admin (`admnin@v2.nexus-x.site`) **auto agent** o hye jabe — same account, sudhu role add.
- Admin agent account create kortey parbe: email + password + **agent_otp_rate** (max 0.70 BDT) set kore.
- Admin agent account **edit** korte parbe anytime (rate, password, active/inactive).
- Admin agent account-e **login/impersonate** korte parbe (jemon ekhon user account-e dhoke).

## 2. Signup flow — agent email mandatory

- Signup form-e notun field: **"Agent Email"** (required, 100%).
- User je agent email dibe, sei agent er under-e jabe (`users.agent_id`).
- Admin email diteo parbe (admin = agent o, tai works).
- Notun user create hobe `status='pending'` — login kortey parbena jotokkhon approve na hoy.

## 3. Approval system

- Agent dashboard-e **Pending Users** list — accept / reject.
- **Admin tar nijer agent email diye signup kora user accept korte parbe**, kintu **onno agent er under er user accept korte parbena** (sudhu sei agent-i parbe). Eta tomar requirement onujayi.
- Accept hole `status='active'`, reject hole delete.

## 4. Agent panel (notun)

`/agent/*` routes — sudhu agent role accessible:

- **Dashboard** — stats (under user count, today's OTP, earning summary)
- **Users** — under user list, profile details, approve pending, **OTP details dekhte parbe kintu OTP code dekhte parbena** (masked: `••••`)
- **Withdraw Requests** — under user der withdraw approve/reject
- **Settings** — nijer profile/password
- **Support Inbox** — sudhu admin ke message, reply thread

User account / OTP / number — agent monitor matro, change kichui korte parbena.

## 5. Per-agent OTP rate

- `users.agent_id` + `users.otp_rate` (agent jokhon user accept kore, agent er current rate user-e copy hoy).
- Rate cap: **0.70 BDT**.
- Admin agent rate change korle **notun user theke** apply hobe (existing user rate untouched — safer).

## 6. Support Inbox

- Notun table `support_threads` + `support_messages`.
- Sudhu **agent ↔ admin** (user der jonne na).
- Admin er jonne global toggle: **support service on/off** (admin settings page-e switch). Off thakle agent message pathate parbena.

## 7. Notices split

- `notices` table-e column `audience` add: `user` | `agent` | `both` (default `user` — backward compatible).
- User-side NoticeBanner sudhu `user` + `both` dekhabe.
- Agent panel-e notun NoticeBanner — sudhu `agent` + `both`.
- Admin notice create form-e audience dropdown.

## 8. Admin email = agent email auto-shift

- Migration-e current admin user-er `user_roles`-e `agent` role add.
- Admin er nijer **otp_rate = 0.60** (current flat rate) set hobe agent hisebe.
- Tomar existing admin email/password kichu change hobena.

---

## Technical (skip korle problem nai)

**Migration `015_agent_system.sql`:**
- `app_role` enum-e `agent` add
- `users`: `agent_id uuid REFERENCES users(id)`, `otp_rate numeric(6,4) DEFAULT 0.60`
- `users.status` default `pending` for new signups via agent flow
- `notices.audience` enum column
- `support_threads`, `support_messages` tables + grants + RLS-free (server-fn checked)
- Helper fn `can_accept_user(agent_id, user_id)` — true if admin OR signup_agent_id matches
- Seed: current admin -> add `agent` role, set otp_rate=0.60

**Server functions:**
- `agent.functions.ts` — listMyUsers, approveUser, rejectUser, listMyWithdrawals, approveWithdrawal, getUserDetails (OTP masked), dashboardStats, listMyNotices
- `admin.functions.ts` extend — listAgents, createAgent, updateAgent, impersonateAgent, toggleSupportService
- `support.functions.ts` — agentSendMessage, adminListThreads, adminReply, getThread
- `auth.functions.ts` signup — require `agent_email`, lookup agent, set `agent_id` + `status=pending` + copy `otp_rate`
- `auth.functions.ts` login — block `status=pending` with "Awaiting agent approval"
- `notices.functions.ts` — filter by audience

**Routes:**
- `/agent/` layout + dashboard/users/withdrawals/settings/support
- `/admin/agents` — list/create/edit/impersonate
- Admin settings — support on/off toggle
- Admin notices form — audience selector
- Signup form — Agent Email field

**Deploy command (per always):**
```bash
cd /opt/nexus-v2 && git pull && \
docker exec -i nexus_db psql -U nexus_v2 nexus_v2 < deployment/migrations/015_agent_system.sql && \
docker compose -f deployment/docker-compose.yml up -d --build nexus_v2_app && \
docker logs --tail=60 nexus_v2_app
```

---

## Confirm korar age 2 ta question:

1. **Existing pending users nai dhore nicchi** — sob current user `active` thakbe, sudhu **notun signup** theke approval flow shuru hobe. OK?
2. **Agent rate update** — existing user der rate **change hobena**, sudhu notun signup theke notun rate. OK? (Naki sob under-user er rate ek shathe update hobe?)

Approve korle migration + sob code ek shathe build kore dibo.