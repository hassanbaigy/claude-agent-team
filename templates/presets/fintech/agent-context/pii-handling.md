# PII / KYC data handling

Personally Identifiable Information in financial systems carries regulatory weight beyond ordinary user data — GLBA, GDPR, CCPA, KYC/AML rules.

## What counts as PII in fintech

Standard PII (name, email, phone) plus financial-specific identifiers:
- Government IDs (SSN, passport, driver's license, national ID)
- Bank account numbers (account, routing, IBAN, SWIFT)
- Card numbers (PAN) and CVV
- Tax IDs (EIN, VAT, GST)
- Date of birth
- Address
- Biometric data (selfie verification, fingerprint)
- KYC documents (uploaded ID photos, proof-of-address documents)

## PCI DSS scope

If you store, process, or transmit cardholder data, you're in PCI scope. The simplest pattern: **don't be in PCI scope.**

- Tokenize via Stripe/Adyen/Braintree — they hold the PAN, you hold a token
- Use hosted/iframed payment fields — your server never sees the PAN
- Card last-4 + brand + expiry is fine to store (called "Sensitive Authentication Data" exclusions)
- Full PAN + CVV: requires PCI DSS certification, network segmentation, regular pen tests, encrypted KSM, etc. ROI almost never makes sense for the average startup.

## Encryption at rest

PII columns at the database level use one of:
- Column-level encryption with a KMS-managed key (rotated yearly)
- Tokenization with a separate token-vault service
- Application-layer encryption with envelope encryption (data key encrypted by KMS key)

Filesystem-level encryption (AWS RDS at-rest encryption) is necessary but NOT sufficient — it doesn't protect against application-layer compromise.

## Logging

PII fields NEVER in logs. Pattern:

```python
# RIGHT
logger.info("KYC verification submitted", user_id=user.id, document_type=doc.type)

# WRONG
logger.info(f"KYC for {user.name} ({user.ssn}) submitted")
```

Most logging libraries support a redaction layer — configure once, applies everywhere.

## Access logging

Every read of PII triggers an audit event (see `audit-events.md`). KYC document downloads especially — these are the highest-value targets for insider abuse.

## Data subject rights

**GDPR Article 17 (right to erasure)**: you must be able to delete PII on request. Build the deletion path BEFORE you launch, not after first request. Test it.

Exemptions: regulatory retention obligations (BSA, AML, tax) usually override deletion requests. Document which fields fall under which exemption.

**GDPR Article 15 (right of access)**: user can request a copy of all data you hold. Build this as a single endpoint that aggregates from every system PII touches.

**CCPA**: similar to GDPR for California residents. The "Do Not Sell My Info" toggle has specific implementation requirements.

## Cross-border transfer

Sending PII from EU to US used to require Privacy Shield, now DPF (Data Privacy Framework). For other corridors, look up the bilateral agreements. Default-safest: keep EU customer data in EU regions (data residency).

## KYC document storage

Uploaded ID documents, selfies, proof-of-address:
- Store in object storage (S3 + KMS, GCS + KMS) with bucket-level encryption
- Object keys are opaque UUIDs, not predictable patterns
- Bucket access policy: only the KYC service can read/write
- Presigned URLs for the customer to upload, time-limited (15 min)
- Lifecycle policy: delete documents after the regulatory retention window

## Never put PII in:
- URL paths or query strings
- Browser `localStorage`
- Error messages echoed to client
- Slack alerts, PagerDuty incidents
- Analytics events (Mixpanel, Amplitude, Segment) — even hashed in many cases
- Frontend bundles / source maps
- Test fixtures (use synthetic data via Faker)
- Sentry / error tracking captures (scrub at the SDK level)
