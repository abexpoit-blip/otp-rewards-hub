# Nexus V2 — Deployment Guide (Bangla)

VPS: `157.173.117.34` (Hostinger, Ubuntu 24.04)
Domain: `v2.nexus-x.site`
Architecture: Existing `nexus_nginx` reverse proxy + `nexus_db` Postgres share kore, V2 app alada container e cholbe (`nexus_v2_app`).

---

## 🚀 First-time setup (ek bar e)

VPS e SSH kore (`ssh root@157.173.117.34`) ei command gulo ek ek kore chalao:

### 1) Repo clone
```bash
cd /opt
git clone https://github.com/<YOUR_LOVABLE_REPO>.git nexus-v2
cd /opt/nexus-v2
```

### 2) .env file banao
```bash
cp .env.example .env
nano .env   # DATABASE_URL er password + SESSION_SECRET + JWT_SECRET change koro
```

### 3) Database create (nexus_db er moddhe notun DB)
```bash
# init-db.sql file e password ta age edit kore nao (must match .env er password)
nano deployment/init-db.sql

# Tarpor run
docker exec -i nexus_db psql -U postgres -d postgres < deployment/init-db.sql
```

### 4) App container build + start
```bash
docker compose -f deployment/docker-compose.yml up -d --build
docker logs -f --tail=50 nexus_v2_app   # check sob thik kina, Ctrl+C diye ber hou
```

### 5) Nginx config copy (HTTP first, SSL pore)
SSL nai bole ekhono HTTPS block kaj korbe na. Temporary HTTP-only config diye certbot run korte hobe:

```bash
# Temporary HTTP-only config
cat > /tmp/v2-temp.conf <<'EOF'
server {
    listen 80;
    server_name v2.nexus-x.site;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 "v2 setup in progress"; add_header Content-Type text/plain; }
}
EOF

docker cp /tmp/v2-temp.conf nexus_nginx:/etc/nginx/conf.d/v2.nexus-x.site.conf
docker exec nexus_nginx nginx -t && docker exec nexus_nginx nginx -s reload
```

### 6) SSL certificate issue (Let's Encrypt)
```bash
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v /opt/nexus/deployment/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d v2.nexus-x.site \
  --email YOUR_EMAIL@example.com --agree-tos --no-eff-email
```
> Output e "Successfully received certificate" dekhle ✅

### 7) Final nginx config (HTTPS sহ) apply koro
```bash
docker cp deployment/nginx/v2.nexus-x.site.conf nexus_nginx:/etc/nginx/conf.d/v2.nexus-x.site.conf
docker exec nexus_nginx nginx -t && docker exec nexus_nginx nginx -s reload
```

### 8) Verify
Browser e: `https://v2.nexus-x.site` — app load hobe ✅

---

## 🔄 Future updates (jokhonই code change hobe)

GitHub e push howar por VPS e:
```bash
cd /opt/nexus-v2
bash deployment/deploy.sh
```

Eta automatic: git pull → docker build → restart → nginx reload।

**Logs check:**
```bash
docker logs -f --tail=100 nexus_v2_app
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| `nginx -t` fail | `docker exec nexus_nginx cat /etc/nginx/conf.d/v2.nexus-x.site.conf` diye config dekho |
| App start na hocche | `docker logs --tail=200 nexus_v2_app` |
| DB connect na hocche | `.env` e DATABASE_URL er password ar init-db.sql er password same kina check koro |
| SSL fail | DNS propagated kina check: `dig v2.nexus-x.site +short` should return `157.173.117.34` |
