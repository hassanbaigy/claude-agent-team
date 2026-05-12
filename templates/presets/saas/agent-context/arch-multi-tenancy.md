# Multi-tenant architecture rules

Universal patterns for any multi-tenant SaaS. The tenancy key is usually called `org_id`, `tenant_id`, `clinic_id`, `workspace_id`, or `account_id` — substitute yours.

## Every query that touches user-owned data MUST filter by the tenant key

```python
# WRONG — leaks across tenants
db.session.query(User).filter(User.id == user_id).one()

# RIGHT — scoped
db.session.query(User).filter(User.id == user_id, User.tenant_id == ctx.tenant_id).one()
```

Bare repository methods (`Model.find`, `Model.findMany`, `db.query`, `prisma.user.findUnique`) without a tenant filter are a tenant-leak bug. Treat them as a BLOCKER in code review.

## The tenant key must come from verified server context, not user input

The tenancy filter value must come from a verified authentication context (decoded JWT claim, validated session, server-side org resolution). NEVER from:
- A request body field
- A URL parameter (`/api/orgs/:orgId/...` is fine for routing but verify the user is actually in that org first)
- An `X-Org-Id` header without server-side verification

The pattern: middleware resolves the active org from the JWT and writes it to a request-scoped context object. Repositories read from that context.

## Cross-tenant operations need an explicit decorator + admin role

Super-admin operations (impersonation, billing reconciliation, data exports) MUST:
1. Be gated by an admin role check
2. Be marked with a `@SkipTenantCheck` / `@CrossTenant` decorator that's grep-able
3. Be audited — every cross-tenant access logged with actor + target

Without (2), grep-based audits can't find every cross-tenant path. Without (3), incident response can't reconstruct what an attacker accessed.

## Schema-per-tenant vs row-level vs hybrid

Three patterns, all valid:
- **Row-level** (single shared schema, tenant_id column on every PHI/user row) — simplest, lowest isolation
- **Schema-per-tenant** (one Postgres schema per tenant) — better isolation, harder migrations
- **Database-per-tenant** — strongest isolation, painful at scale

Whichever you pick, write it in CLAUDE.md so future agents stop guessing. Mixing them within a single repo is a recipe for tenant-leak bugs at the boundary.

## Test pattern: explicit multi-tenant test

Every PR that touches data access should add a test that:
1. Creates two tenants
2. Inserts a row for tenant A
3. Queries from tenant B's context
4. Asserts the row is not visible

If your repo doesn't have this kind of test fixture, build one — it pays for itself within the first month.
