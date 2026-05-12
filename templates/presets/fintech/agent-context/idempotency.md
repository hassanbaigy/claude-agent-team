# Idempotency — every money-moving endpoint needs it

Network calls retry. Clients reconnect after dropped responses. Without idempotency, every retry is a duplicate charge.

## Server-side requirement

Every state-changing API endpoint that moves money REQUIRES an `Idempotency-Key` header on the request. Reject the request if it's missing:

```python
@app.post("/api/charges")
async def create_charge(
    request: ChargeRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
):
    ...
```

## Storage shape

```sql
CREATE TABLE idempotency_keys (
    key TEXT NOT NULL,
    tenant_id UUID NOT NULL,
    request_hash TEXT NOT NULL,        -- hash of request body
    response_status INT,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,   -- 24h+ typical
    PRIMARY KEY (key, tenant_id)
);
```

Key + tenant_id is the unique constraint. Same key from different tenants is fine; same key + same tenant must dedupe.

## Replay handling

On request:
1. Look up `(key, tenant_id)`.
2. If not found → proceed, then write the response back to the row.
3. If found AND `request_hash` matches → return the cached response, status code intact, no re-processing.
4. If found AND `request_hash` does NOT match → return 422 "idempotency key reused with different payload".

Case 4 catches client bugs where the same key is reused across logically different requests.

## Client key generation

Generate the key client-side as a UUID v4 per business operation. The same operation retried = same key. A new operation = new key.

```typescript
const idempotencyKey = crypto.randomUUID();  // generate ONCE per logical request
await fetch("/api/charges", {
  method: "POST",
  headers: { "Idempotency-Key": idempotencyKey, ... },
  body: JSON.stringify(payload),
});
// retries reuse the same idempotencyKey
```

## Race condition: two simultaneous requests with the same key

Use `INSERT ... ON CONFLICT DO NOTHING` (Postgres) or equivalent. The loser of the race waits and reads the winner's stored response.

Alternative: use a row lock pattern — `SELECT FOR UPDATE`, process, write response. But the conflict-insert pattern is simpler and avoids holding a transaction open for the entire downstream call.

## Cache layer optimization

For very high-throughput endpoints, write the key to Redis immediately with a short TTL when the request is accepted. Process, then write the full response to Redis + the durable store. Future replays hit Redis first.

Beware: if Redis is the only store, a Redis failure means an idempotency-key gap. Durable Postgres-backed store is the source of truth; Redis is the read-through cache.

## Retention

Keep idempotency records for at least 24 hours. 7 days is safer — covers timezone weirdness, weekend batches, manual retry-after-investigation.

After expiration the record can be deleted. The replay window is now over.

## Pair with the transaction ledger

Every money-moving operation creates an entry in the transactions ledger (see `audit-events.md`). The idempotency key should be a column on that entry — pull together the request → key → ledger row chain for any forensics question.
