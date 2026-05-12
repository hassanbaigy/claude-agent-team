# Billing integrity (Stripe, Paddle, Lemonsqueezy, custom)

Money is more correctness-sensitive than any other surface. These rules apply across providers.

## Currency is integers, never floats

Store amounts as integer minor units (cents, paise, satoshi). Currency code on the same column or an adjacent one (ISO 4217). NEVER store dollars-and-cents as `float` — IEEE 754 representation errors create off-by-one-cent invariants over time.

```python
# RIGHT
amount_minor: int  # cents
currency: str  # "USD", "EUR", ...

# WRONG
amount: float  # 19.99 is unrepresentable exactly
```

## Idempotency-Key on every charge / refund / subscription mutation

Stripe and other providers retry on network errors. Without an idempotency key, a retry creates a duplicate charge. Generate the key at the call site, use the same key on retries.

```python
stripe.Charge.create(
    amount=amount_minor,
    currency="usd",
    customer=customer_id,
    idempotency_key=f"charge:{order_id}:{attempt_id}",
)
```

The key should be deterministic from the business operation, not random.

## Webhook event ordering is NOT guaranteed

Stripe does not guarantee webhook delivery order. You can receive `invoice.payment_succeeded` BEFORE `invoice.created`. Patterns that work:

- Store events by ID + payload hash (see `webhooks.md`)
- Process them in order of the stamped timestamp from the provider, not arrival order
- Treat each event as "this is the current state, apply it" rather than "this is the next event, advance state"

## Customer ID is a foreign key, NOT authority

The customer ID on a webhook event tells you which customer record to update — it does NOT prove the request came from that customer. Sign the webhook (`webhooks.md`) and verify ownership for any user-initiated billing action server-side.

## Dunning is a state machine, not a boolean

`payment_failed` doesn't mean the customer is delinquent. Track:
- `current_period_end` — when their subscription expires
- `payment_retry_count`
- `dunning_state`: `active` / `past_due` / `grace_period` / `canceled`
- `grace_period_end`

Don't gate features on a single boolean. Use the state machine.

## Charge AFTER persist, not before

If you charge first and then your DB commit fails, the user gets billed for something they don't see. If you persist first and the charge fails, you can retry the charge. Persist → charge.

## Refunds are a separate accounting event

A refund is a NEW row in your transactions ledger, not a deletion or update of the original charge. Append-only ledgers make reconciliation tractable.

## Test mode keys must NEVER be on prod

Stripe test keys start with `sk_test_`, live keys with `sk_live_`. A reviewer check should grep for `sk_test_` in any file outside test/ — if it's in production code, the build should fail.
