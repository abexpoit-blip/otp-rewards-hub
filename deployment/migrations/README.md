# Database Migrations

প্রতিটা `.sql` file ordered (001, 002, ...) এবং idempotent। VPS এ একবার চালান:

```bash
# এক বার, schema setup
docker exec -i nexus_db sh -c 'psql -U nexus_v2 -d nexus_v2' < deployment/migrations/001_init.sql
```

নতুন migration আসলে শুধু সেটাই চালাবেন:

```bash
docker exec -i nexus_db sh -c 'psql -U nexus_v2 -d nexus_v2' < deployment/migrations/002_xxx.sql
```

## যদি nexus_v2 database/role আগে create করা না থাকে

```bash
docker exec -i nexus_db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < deployment/init-db.sql
```

এটা `nexus_v2` user + database তৈরি করে। তারপর `001_init.sql` চালান।
