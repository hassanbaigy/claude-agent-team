# Audit trail (§164.308 / §164.312)

HIPAA requires technical safeguards to record and examine activity in systems containing PHI. This is operational, not aspirational — surveyors will ask for it during a real audit.

## What gets audited

Every CRUD operation on PHI:
- **Read**: a clinician views a patient record → audit event
- **Create**: a new appointment row → audit event
- **Update**: any field on a PHI row changes → audit event
- **Delete / soft-delete**: PHI removed → audit event
- **Export**: data leaving the system (CSV download, API export) → audit event with row count + recipient

Bulk operations: emit ONE event per row affected, not one summary event. Auditors need to know exactly which records were touched.

## Event shape

Minimum fields per audit event:

| Field | Why |
|---|---|
| `event_id` | unique, indexable |
| `timestamp` | UTC, ms precision |
| `actor_user_id` | WHO did it |
| `actor_role` | what role were they acting as |
| `tenant_id` (`clinic_id`) | which tenant's data |
| `action` | `read` / `create` / `update` / `delete` / `export` |
| `resource_type` | `patient`, `appointment`, `claim`, etc. |
| `resource_id` | the PHI row's primary key |
| `ip_address` | source IP |
| `user_agent` | source client |
| `request_id` | correlation to application logs |
| `success` | boolean — failed access attempts must also be logged |
| `metadata` | e.g. for updates, the field names that changed (NOT the values — values may be PHI) |

## Append-only

Audit logs are append-only. No `UPDATE`, no `DELETE`. If you need to correct an audit entry, append a corrective entry that references the original — never overwrite history.

## Retention: 6 years

§164.316(b)(2) — six years from creation OR last effective date, whichever is later. Cold storage is fine; deleted is not.

## Search by user + date range must be performant

A real audit query: "show me everything Dr. X accessed between Jan 1 and Mar 31." This must return in seconds, not hours. Index appropriately:

```sql
CREATE INDEX audit_actor_time ON audit_events (actor_user_id, timestamp);
CREATE INDEX audit_resource ON audit_events (resource_type, resource_id, timestamp);
CREATE INDEX audit_tenant_time ON audit_events (tenant_id, timestamp);
```

## Async emit, but at-least-once

Audit emission shouldn't block the user request. Pattern:

1. App writes event to a local queue / transactional outbox
2. Background worker drains queue to the audit store
3. On crash mid-operation: events stay in the outbox, eventually drain

Lost events = compliance violation. At-least-once delivery is mandatory; duplicates are tolerable.

## Failed access attempts are still audited

Someone tries to access a patient they don't have permission for → the FAILED attempt is also an audit event. This is where breach detection lives — failed-access patterns are the leading indicator.

## Don't put PHI VALUES in audit metadata

Audit events should reference WHAT was accessed (resource_id, field names changed), not the actual values. Otherwise the audit log itself becomes a PHI store with double the compliance surface.

## Real audit queries to pre-build

Have these as named queries / stored procedures so they're ready when needed:

1. "All access events by user X, between dates A and B" — for §164.308(a)(1)(ii)(D) workforce sanction investigations
2. "All access to patient P, between dates A and B" — for patient accounting-of-disclosures requests (§164.528)
3. "Failed access attempts in last 30 days, grouped by user" — for breach detection
4. "Cross-tenant access events" — should always be near-zero; spike = incident
