# Webhook gotchas

Universal patterns for inbound webhooks from Stripe, GitHub, Slack, Twilio, etc.

## Signature verification must FAIL CLOSED

If the verification secret env var is empty/missing, verification must `return False` — NOT pass-through. A misconfigured deploy with `WEBHOOK_SECRET=""` should make your webhook endpoint refuse everything, not become a public unauthenticated POST.

```python
def verify_signature(body: bytes, signature: str, secret: str) -> bool:
    if not secret:
        return False  # ✓ fail closed
    return hmac.compare_digest(
        hmac.new(secret.encode(), body, hashlib.sha256).hexdigest(),
        signature,
    )
```

## Verify on the RAW request body, before any parsing

Frameworks that auto-parse JSON (Express, FastAPI) re-serialize and may reorder keys or change whitespace, breaking the HMAC. Capture the raw `bytes` body BEFORE parsing.

## Idempotency: dedupe on `(provider_event_id, hash(payload))`

Providers replay webhooks on transient failures. Dedupe on:
1. The provider's event ID (`stripe_event.id`, `slack_event_id`, etc.)
2. AND a hash of the meaningful payload — because providers occasionally REUSE event IDs with different payloads (Slack does this for thread reply events).

The provider's `Idempotency-Key` header alone isn't enough.

## Constant-time signature comparison

Use `hmac.compare_digest()` / `crypto.timingSafeEqual()`. Plain `==` leaks signature bytes via timing.

## Replay window

Reject webhooks where the provider-stamped timestamp is more than 5 minutes old. Stops replay attacks that intercept a single valid request.

## Async processing pattern

1. Receive request
2. Verify signature on raw body
3. Parse + persist event to a queue table (status='pending')
4. Return 200 OK
5. Worker picks up pending events, processes, updates status

Don't do the work synchronously. Webhook providers retry on timeout (3-10s typical), and a slow downstream creates duplicate processing.

## Webhook URL hygiene

- Each integration gets its own URL (`/webhooks/stripe`, `/webhooks/github`), not a catch-all
- URL path includes the integration name so logs/metrics segment naturally
- Per-integration auth secret (don't share one secret across providers)
