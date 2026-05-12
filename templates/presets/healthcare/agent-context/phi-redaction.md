# PHI redaction patterns

How to scrub PHI from logs, errors, analytics, and any data egressing your tenant boundary.

## Whitelist > blacklist

Default-deny is safer. Define an allowlist of fields that are safe to log; redact everything else.

```python
SAFE_LOG_FIELDS = {"id", "created_at", "status", "type", "request_id"}

def safe_log_payload(d: dict) -> dict:
    return {k: v for k, v in d.items() if k in SAFE_LOG_FIELDS}
```

This catches future-added fields automatically. Blacklists let new PHI fields leak until someone notices.

## Logging library pattern: filter at the sink

Wrap your logger with a PHI scrubber. Run it on every record before it reaches the log infrastructure.

```python
import re

PHI_PATTERNS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN]"),
    (re.compile(r"[\w._%+-]+@[\w.-]+\.\w+"), "[EMAIL]"),
    (re.compile(r"\b\d{10,}\b"), "[NUMBER]"),  # phone, MRN
]

def scrub(s: str) -> str:
    for pat, repl in PHI_PATTERNS:
        s = pat.sub(repl, s)
    return s

class PHILoggerFilter(logging.Filter):
    def filter(self, record):
        record.msg = scrub(str(record.msg))
        return True
```

## Error messages must not echo user input

```python
# WRONG — echoes email (PHI), enables enumeration
raise HTTPException(404, f"User {email} not found")

# RIGHT
raise HTTPException(404, "User not found")
```

Use a request_id (correlation ID) for support, NOT the user-identifying value.

## Frontend storage

- `localStorage`: never PHI. Persists indefinitely, accessible to any script on the page.
- `sessionStorage`: PHI only if necessary, cleared on tab close. Encrypt if you must.
- React state: fine while in memory, but don't serialize to disk via Redux Persist etc. without scrubbing.

## Request body capture in error tracking

Sentry, Bugsnag, etc. capture request bodies by default. Configure them to scrub PHI fields BEFORE sending, not after — your error tracker must never receive raw PHI.

```javascript
Sentry.init({
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = scrubPHI(event.request.data);
    }
    return event;
  },
});
```

## Analytics events

Page-view tracking is mostly fine. Custom event properties are where PHI leaks:

```javascript
// WRONG
analytics.track("Patient Viewed", { patient_name, diagnosis });

// RIGHT
analytics.track("Patient Viewed", { patient_id_hash, page_section });
```

## URL parameters

Never put PHI in URL paths or query strings. URLs end up in:
- Server access logs
- Browser history
- Referer headers on outbound links
- CDN/proxy logs
- Bookmark databases

```
WRONG: /patients?email=jane@example.com
RIGHT: /patients/  (POST with body, or use opaque session-scoped ID in path)
```

## Search index safety

Cleartext PHI in Elasticsearch / OpenSearch / Algolia is OK only if:
- The index is encrypted at rest
- Access is tightly RBAC-controlled
- The provider has a signed BAA
- The index is not replicated to a non-BAA-covered region or service

## Test fixtures

Synthetic PHI in test fixtures must look like PHI (correct format) but be obviously fake. Use generator libraries (Faker for Python, faker-js) — never copy real patient data into a test fixture, even anonymized.
