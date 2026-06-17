# Project Memory

## Core
Project: Number Panel (clone of stexsms.com/m29) — users submit numbers, earn fixed amount per successful OTP.
Stack: TanStack Start frontend. Backend + database + storage = self-hosted on user's VPS. DO NOT use Supabase / Lovable Cloud / Lovable DB.
VPS IP: 157.173.117.34 (Hostinger). Already runs an existing number panel — be careful, do not break existing services.
Domain for THIS new project: v2.nexus-x.site (A record → 157.173.117.34 already configured).
Other subdomains (x, www, api, tg, @) are already in use by other apps on the VPS — do not touch.
Deployment flow: GitHub → VPS (pull + build + PM2 + Nginx). Provide exact deploy + log commands after every backend change.
Reference site: https://stexsms.com/m29/ (login: samexpoit@gmail.com / Shovon@2013).

Backend stack: TanStack Start server functions + Postgres (postgres-js) + JWT (jsonwebtoken) + bcryptjs. No separate API container.
DB: existing nexus_db Postgres container, database `nexus_v2`, hostname `nexus_db:5432` from app container (shared deployment_nexus_network).
stex provider model = Reseller (single admin key for all panel users). Phase 2 will integrate.
Migrations: `deployment/migrations/NNN_*.sql`, run via `docker exec -i nexus_db sh -c 'psql -U nexus_v2 -d nexus_v2' < file.sql`.

## Memories
- [VPS & Domain Infrastructure](mem://infra/vps) — Hostinger VPS IP, domain map, deployment flow
- [stex SMS provider API](mem://infra/stex-api) — base URL, mauthapi header, 4 endpoints (getnum/liveaccess/success-otp/console), reseller model

