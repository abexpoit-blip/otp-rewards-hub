# Project Memory

## Core
Project: Number Panel (clone of stexsms.com/m29) — users submit numbers, earn fixed amount per successful OTP.
Stack: TanStack Start frontend. Backend + database + storage = self-hosted on user's VPS. DO NOT use Supabase / Lovable Cloud / Lovable DB.
VPS IP: 157.173.117.34 (Hostinger). Already runs an existing number panel — be careful, do not break existing services.
Domain for THIS new project: v2.nexus-x.site (A record → 157.173.117.34 already configured).
Other subdomains (x, www, api, tg, @) are already in use by other apps on the VPS — do not touch.
Deployment flow: GitHub → VPS (pull + build + PM2 + Nginx). Provide exact deploy + log commands after every backend change.
Reference site: https://stexsms.com/m29/ (login: samexpoit@gmail.com / Shovon@2013).

## Memories
(none yet)
