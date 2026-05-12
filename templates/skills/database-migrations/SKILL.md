---
name: database-migrations
description: Creating or modifying database migrations. Covers zero-downtime patterns, index creation safety on large tables, backfill ordering, schema-code deploy ordering, and rollback testing. Activate for any change to migrations/, prisma/migrations/, alembic/versions/, db/migrate/, or any file named *_migration.* / migrate_*.
---

# Database migration skill

How this codebase wants schema changes shipped. Read before opening any migration file.

Migrations are the highest-blast-radius operation in production. The defaults below assume a live system with traffic. For greenfield / pre-launch, you can relax some constraints — but the discipline is what saves you when traffic arrives.

## Step 0 — detect the migration tool

```bash
ls prisma/migrations/ 2>/dev/null    # Prisma
ls alembic/versions/ 2>/dev/null     # SQLAlchemy / Alembic
ls db/migrate/ 2>/dev/null           # Rails / ActiveRecord
ls migrations/ 2>/dev/null           # generic
ls knex/migrations/ 2>/dev/null      # Knex.js
ls drizzle/ 2>/dev/null              # Drizzle
```

Match the tool's convention. Don't introduce a second migration system.

## Step 1 — the safety review checklist

For EVERY migration, before merging:

| Check | Required? |
|---|---|
| Forward migration is idempotent (re-running doesn't break) | ✅ |
| Down / rollback path exists and has been tested | ✅ |
| Schema change is backwards-compatible with currently-deployed code | ✅ |
| Indexes on tables > 1M rows use CONCURRENTLY (Postgres) / ONLINE (MySQL) | ✅ |
| `NOT NULL` columns added to existing tables include a DEFAULT | ✅ |
| Column rename: two-phase (add new, backfill, switch code, drop old) | ✅ |
| Type change on large table: two-phase (add new column, dual-write, switch reads, drop old) | ✅ |
| FK additions on large tables use NOT VALID + VALIDATE separately | ✅ |
| Transaction-wrapped (single migration = single transaction OR explicit reason not to) | ✅ |

## Step 2 — the deploy ordering rule

Code and schema must be deployable in EITHER ORDER without breaking. Three patterns:

### Adding a column
1. Migration: add nullable column (or with default)
2. Deploy code that can read OR ignore the column
3. Backfill data
4. Deploy code that depends on the column
5. (later) Migration to set NOT NULL

### Renaming a column
1. Migration: add new column
2. Deploy code that writes BOTH old AND new (dual-write)
3. Backfill old → new
4. Deploy code that reads new only
5. (later) Migration: drop old column

### Removing a column
1. Deploy code that stops using the column
2. Wait for old code to drain (deploys, rollback window)
3. Migration: drop the column

NEVER drop a column in the same release where you stop using it. The window for a rollback during deploy is when you'll need that column.

## Step 3 — index creation on large tables

```sql
-- WRONG — locks writes on the table during build
CREATE INDEX users_email_idx ON users(email);

-- RIGHT — Postgres, doesn't lock writes
CREATE INDEX CONCURRENTLY users_email_idx ON users(email);

-- Caveat: CONCURRENTLY can't run inside a transaction
-- Most migration tools wrap migrations in a transaction by default; opt out for this one.
```

For Prisma: use a raw SQL migration. For Alembic: `op.create_index(..., postgresql_concurrently=True)` + set `transactional=False`.

CONCURRENTLY can fail mid-build (deadlock, conflict). When it does, the index is left in INVALID state. Pair the migration with a verify step:

```sql
SELECT relname, indisvalid FROM pg_class JOIN pg_index ON pg_class.oid = indexrelid
WHERE relname = 'users_email_idx';
```

If `indisvalid = false`, drop and retry.

## Step 4 — backfills

Backfilling 100 rows: inline in the migration is fine.

Backfilling 10M rows: a migration that runs in seconds is a migration that locks the table for seconds. Always:

1. Make schema change in the migration (add column, etc.)
2. Backfill in a separate job — batched, with sleep between batches, monitor-friendly

```python
# Pseudo — batched backfill
BATCH = 1000
last_id = 0
while True:
    rows = session.execute(
        "SELECT id FROM users WHERE new_col IS NULL AND id > :last ORDER BY id LIMIT :n",
        {"last": last_id, "n": BATCH},
    ).fetchall()
    if not rows: break
    ids = [r.id for r in rows]
    session.execute("UPDATE users SET new_col = derive(...) WHERE id = ANY(:ids)", {"ids": ids})
    session.commit()
    last_id = ids[-1]
    time.sleep(0.1)  # back off pressure on replication
```

## Step 5 — multi-tenant / per-schema migrations

If the codebase uses schema-per-tenant or row-level multi-tenancy:

- Schema-per-tenant: migration iterates over all tenant schemas. Test on 1, 100, and the production tenant count.
- Row-level: a single migration covers all tenants, but watch out for the row-count multiplier (10K tenants × 1K rows each = 10M rows).

If a migration touches a tenant-scoped table, add a tenant-coverage check (every tenant has the new column / index after migration).

## Step 6 — rollback testing

Every migration's down path MUST be tested before merge:

```bash
# Run forward
npm run db:migrate

# Verify schema
npm run db:dump > before.sql

# Run backward
npm run db:rollback

# Schema should be back to where it started (modulo timestamp metadata)

# Run forward again — should succeed (idempotency)
npm run db:migrate
```

If rollback throws, you've shipped a migration you can't recover from in an incident.

## Step 7 — destructive operations

DROP COLUMN, DROP TABLE, DROP INDEX (non-CONCURRENTLY), TRUNCATE — these are irreversible in production. They MUST:

- Have a separate PR labelled `destructive` or `irreversible`
- Be reviewed by someone in addition to the author
- Be deployed during a low-traffic window
- Have a runbook for "if this breaks something, what's the recovery path?" (often: restore from snapshot)

## Anti-patterns to avoid

- `DROP COLUMN` in the same release that stops using the column
- Adding a NOT NULL column without a default on a non-empty table
- Renaming a column in a single migration (always two-phase)
- Backfilling 1M+ rows in the migration itself
- `CREATE INDEX` without `CONCURRENTLY` on a large table
- Migrations that depend on application code being deployed first
- Migrations without a tested rollback path
- Migrations that run application-level code (call services, send notifications) — keep them schema-only

## Before declaring done

- Migration file generated with the correct timestamp / version prefix
- Forward path passes locally
- Rollback path passes locally
- Idempotent re-run passes
- Reviewed against the safety checklist above
- If destructive: separately reviewed
