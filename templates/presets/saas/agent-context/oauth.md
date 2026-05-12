# OAuth integration gotchas

For both OAuth-the-provider (you grant access to others) and OAuth-the-client (you call other people's APIs).

## `state` parameter is required for every authorization request

Generate a cryptographically-random state, store it server-side keyed by session, include it in the authorization URL, verify it on callback. Missing/skipped state = CSRF on the OAuth flow.

```python
state = secrets.token_urlsafe(32)
session["oauth_state"] = state
return redirect(f"{auth_url}?state={state}&...")

# on callback
if request.args.get("state") != session.pop("oauth_state", None):
    raise HTTPException(400, "invalid state")
```

## Redirect URI: EXACT match, not pattern

The redirect URI registered with the OAuth provider must be an exact string match. Allowing wildcards or subdomains is a classic auth-bypass vector — attacker registers `accounts.evil.com` as a subdomain, your wildcard `*.evil.com` lets them complete the flow on a controlled domain.

## PKCE for public clients

If your client is a mobile app, SPA, or anything where you can't keep a secret, use PKCE (RFC 7636). Even for confidential clients, PKCE is now best practice.

## Scope minimization

Start with read-only scopes. Adding scopes later is annoying but possible; removing scopes after launch is a UX nightmare. Don't request `repo` if you only need `public_repo`.

## Token storage

- **Access tokens**: encrypt at rest, short TTL, NOT logged anywhere
- **Refresh tokens**: encrypt at rest, treat as equivalent to a password
- Never put tokens in URLs (server logs, browser history, Referer header)
- Never put tokens in client-side `localStorage` for browser clients — use httpOnly cookies

## Refresh token rotation

When you use a refresh token, get a new refresh token in the response, and INVALIDATE the old one. Detecting reuse of a rotated refresh token = compromised account, revoke the session.

## SSO-specific (SAML, OIDC)

- Verify the SAML response signature (XML-DSig is its own footgun — use a library, don't roll your own)
- Check audience, issuer, NotBefore, NotOnOrAfter
- Map SSO group → role server-side, don't trust client-side group claims for privilege decisions
