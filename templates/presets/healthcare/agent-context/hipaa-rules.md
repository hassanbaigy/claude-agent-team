# HIPAA — core rules every agent must know

US healthcare regulation. If your product handles Protected Health Information (PHI), these apply.

## What counts as PHI

HIPAA Safe Harbor defines 18 identifiers. Any combination of these + health info = PHI:

1. Name
2. Geographic subdivisions smaller than state (street, city, ZIP — except first 3 digits in low-density areas)
3. All elements of dates except year (DOB, admission date, etc.) for ages ≤89
4. Phone numbers
5. Fax numbers
6. Email addresses
7. Social Security numbers
8. Medical record numbers (MRN)
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers
13. Device identifiers and serial numbers
14. URLs
15. IP addresses
16. Biometric identifiers (fingerprints, voiceprints)
17. Full-face photographs
18. Any other unique identifying number / characteristic / code

If your data has any of these PLUS a health-related fact, it's PHI. Treat it accordingly.

## Logs and errors must NOT contain PHI

A log line containing a patient's email + their visit reason is a HIPAA violation. Pattern:

- Scrub PHI fields before writing to log infrastructure
- Error messages return generic strings ("invalid input") instead of echoing the offending value
- Stack traces are fine; user input embedded in stack traces is not
- See `phi-redaction.md` for concrete patterns

Common leak surfaces to grep:
- `logger.info(f"...{patient.email}...")` ← BLOCKER
- `raise HTTPException(400, f"User {email} not found")` ← BLOCKER (also account enumeration)
- `console.log(req.body)` in JS, where body may contain PHI fields ← BLOCKER
- Sentry / error tracking that captures request bodies — scrub before sending

## Audit controls (§164.312(b))

Every read, create, update, or delete of PHI must emit an audit event. See `audit-trail.md` for the event shape and retention rules.

## Minimum necessary (§164.514(d))

A role should only see the PHI it needs. A billing staffer doesn't need to see clinical notes. A provider doesn't need to see another provider's patients. RBAC must be field-level or row-level, not "you have access to the patients table".

## BAA required for any third-party handling PHI

Any service you send PHI to (Sentry, Datadog, Twilio, SendGrid, AWS, GCP) requires a signed Business Associate Agreement. Without a BAA, sending them PHI is a violation regardless of how secure their service is.

Common surprises:
- **Sentry**: requires their Business plan + signed BAA. Default error tracking with PHI is non-compliant.
- **SendGrid / Twilio**: require BAA + use of HIPAA-flagged subaccounts.
- **OpenAI / Anthropic / Google Gemini API**: most consumer-tier API plans do NOT cover PHI. Check the plan.
- **Logging providers** (Datadog, Splunk): BAA + scrubbed-at-source is the safest pattern; rely on scrubbing alone is risky.

## Encryption requirements

- At rest: AES-256 (most cloud providers default this)
- In transit: TLS 1.2+ everywhere, including internal service-to-service
- Backups: also encrypted, also retained per the same rules

## Retention (§164.316(b)(2))

HIPAA documentation (policies, audit logs, access logs) must be retained for **6 years** from creation or last effective date, whichever is later.

## Breach notification (§164.404)

Discovered breach affecting >500 individuals → notify HHS within 60 days, notify affected individuals "without unreasonable delay" (max 60 days from discovery). Smaller breaches: annual report.

This is why every PHI access needs an audit log — without it, you can't determine the scope of a breach.
