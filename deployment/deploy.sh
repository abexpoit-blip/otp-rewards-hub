#!/usr/bin/env bash
# Nexus V2 deploy script. VPS er /opt/nexus-v2/ folder theke chalao.
# Usage:  bash deployment/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/4] Git pull latest"
git pull origin main || git pull origin master || true

echo "==> [2/4] Build & start container (no downtime jodi already cholche)"
docker compose -f deployment/docker-compose.yml up -d --build

echo "==> [3/4] Reload nginx config (jodi notun)"
docker cp deployment/nginx/v2.nexus-x.site.conf nexus_nginx:/etc/nginx/conf.d/v2.nexus-x.site.conf
docker exec nexus_nginx nginx -t && docker exec nexus_nginx nginx -s reload

echo "==> [4/4] Status"
docker ps --filter "name=nexus_v2_app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "✅ Deploy done. Logs: docker logs -f --tail=100 nexus_v2_app"
