# Audit events — every money-moving call leaves a trace

Append-only ledger of every operation that affects money. Required for regulatory compliance, dispute resolution, internal reconciliation, and fraud detection.

## Event shape

Minimum fields for every money-moving operation:

| Field | Why |
|---|---|
| `event_id` | unique, indexable, UUID |
| `created_at` | UTC, ms precision |
| `actor_user_id` | who initiated (NULL for system jobs, with actor_type='system') |
| `actor_type` | `user` / `system` / `webhook` / `api_client` |
| `tenant_id` | which account |
| `action` | `charge` / `refund` / `transfer` / `payout` / `dispute` / etc. |
| `target_account_id` | what was acted on |
| `amount_minor` | always positive — sign comes from action type |
| `currency` | ISO 4217 |
| `idempotency_key` | links to the request that created this |
| `external_provider` | `stripe` / `plaid` / `wise` / internal |
| `external_id` | provider's identifier for this operation |
| `request_id` | correlation to app logs |
| `ip_address` | source IP (for user-initiated events) |
| `success` | boolean — failures are recorded too |
| `metadata` | typed JSONB — operation-specific |

## Append-only — no UPDATE, no DELETE

The ledger is the source of truth. Corrections happen via new entries that reference the original (`correction_of: <event_id>`). Otherwise reconstructing history requires WAL archaeology.

```sql
ALTER TABLE audit_events ADD CONSTRAINT no_updates CHECK (1=1);
REVOKE UPDATE, DELETE ON audit_events FROM application_role;
```

Enforce at the database level. Application code can be wrong; a DB constraint can't be.

## Write BEFORE the external call, then update on response

The pattern that survives partial failures:

1. Insert audit event with `status='pending'`, the request payload, the idempotency key
2. Make the external call
3. Update the audit event with `status='success'|'failed'`, the response, the provider's transaction ID

If the process crashes between 1 and 2, a recovery worker finds the `pending` row and either:
- Queries the provider (with the same idempotency key) to find out what actually happened
- Marks as `unknown` for manual review

This is how you NEVER lose a money event, even with process crashes mid-transaction.

## Retention — regulator-specific, default 7 years

- US (SOX, BSA, AML): 5-7 years depending on the operation
- EU (PSD2, AMLD): 5 years
- UK (FCA): 5 years
- Crypto/MSB (FinCEN): 5 years
- Customer dispute window (Visa/MC): 540 days minimum

Default to 7 years to cover every common framework, then prune by jurisdiction-specific rules.

## Reconciliation queries

Build these as named queries from day one — you will need them within 6 months:

1. "Sum of all charges by tenant_id, between dates A and B"
2. "Daily transaction count + amount by action type"
3. "Pending events older than 1 hour" — operational health, should be empty
4. "Events with external_provider failures, by error_code, last 24h"
5. "Cross-currency transfers — list source/target/rate"

## Indexes

```sql
CREATE INDEX audit_tenant_time ON audit_events (tenant_id, created_at);
CREATE INDEX audit_actor_time ON audit_events (actor_user_id, created_at);
CREATE INDEX audit_idempotency ON audit_events (idempotency_key);
CREATE INDEX audit_external ON audit_events (external_provider, external_id);
CREATE INDEX audit_status_pending ON audit_events (status, created_at) WHERE status = 'pending';
```

The pending-status partial index makes the operational health check O(small) regardless of total table size.

## Cross-reference with idempotency keys

Every audit event carries the idempotency key from the originating request. This is how you trace:

```
client request → idempotency_keys row → audit_events row → external provider txn
```

Any layer breaks, you can still rebuild the chain from the next layer in.

## Sensitive data in metadata

`metadata` is JSONB and may contain identifiers (account numbers, card last-4) but should NEVER contain full card numbers, full SSNs, or other PCI/regulated identifiers in cleartext. If you must store them, store hashes and keep the cleartext in a PCI-scoped vault.
