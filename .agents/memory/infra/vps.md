---
name: VPS & Domain Infrastructure
description: Hostinger VPS IP, domain map, deployment target for Number Panel
type: feature
---

# VPS
- Provider: Hostinger
- IP: 157.173.117.34
- Already hosts an existing number panel + other apps — DO NOT overwrite, reconfigure ports/nginx blindly, or run destructive commands.

# Domains (nexus-x.site on Hostinger DNS)
| Record | Name | Target | Used by |
|--------|------|--------|---------|
| A | @ | 157.173.117.34 | existing app |
| A | x | 157.173.117.34 | existing app |
| CNAME | www | nexus-x.site | existing |
| A | api | 157.173.117.34 | existing API |
| A | tg | 161.97.100.218 | other VPS |
| A | **v2** | **157.173.117.34** | **THIS new Number Panel** |

# Deployment
- Code: GitHub → pulled on VPS
- Build: `bun install && bun run build`
- Process: PM2
- Reverse proxy: Nginx (new server block for v2.nexus-x.site only — never edit existing blocks)
- SSL: certbot for v2.nexus-x.site
- Storage / DB: self-hosted on VPS (Postgres or similar) — NOT Supabase, NOT Lovable Cloud
