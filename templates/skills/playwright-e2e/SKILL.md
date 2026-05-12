---
name: playwright-e2e
description: Writing or modifying Playwright end-to-end tests. Covers the team's session helpers, page object pattern, test data factories, waiting strategies, and CI conventions. Activate for any file matching tests/e2e/**, *.e2e.ts, *.spec.ts under a Playwright config.
---

# Playwright E2E skill

How this codebase wants E2E tests built. Read before adding any new `.e2e.ts` or `.spec.ts`.

## Step 0 — find the existing patterns

```bash
# Where E2E lives
find . -type d \( -name "e2e" -o -name "playwright" \) 2>/dev/null | head -5
cat playwright.config.{ts,js} 2>/dev/null | head -50

# Existing helpers — the team's session / auth helper probably lives here
find tests -name "helpers" -type d 2>/dev/null
find tests -iname "*login*" -o -iname "*auth*" -o -iname "*fixture*" 2>/dev/null | head

# Existing page objects
find tests -name "*.page.ts" -o -name "*Page.ts" 2>/dev/null | head
```

**If a session helper exists, use it.** Do NOT re-implement login in your test.

## Step 1 — naming and structure

```
tests/
├── e2e/
│   ├── auth.spec.ts          # one spec file per user-facing flow
│   ├── checkout.spec.ts
│   └── settings.spec.ts
├── helpers/
│   ├── loginAs.ts            # session / auth helpers
│   └── testData.ts           # factories
└── pages/
    ├── CheckoutPage.ts       # page objects
    └── SettingsPage.ts
```

Test file name = the user-facing flow, NOT the implementation module.

## Step 2 — Page Object pattern

Each page in the app has a corresponding page object. Selectors live there, not in test files.

```typescript
// tests/pages/CheckoutPage.ts
export class CheckoutPage {
  constructor(private page: Page) {}

  async goto() { await this.page.goto("/checkout"); }
  async fillCard(num: string, exp: string, cvc: string) {
    await this.page.fill('[data-testid="card-number"]', num);
    // ...
  }
  async submit() { await this.page.click('[data-testid="submit-payment"]'); }
}
```

Selectors: prefer `data-testid` over CSS classes (classes change with refactors; testids should be stable).

## Step 3 — test data factories

Never hardcode user data inside test files. Use a factory:

```typescript
// tests/helpers/testData.ts
export const newUser = (overrides = {}) => ({
  email: `test+${Date.now()}@example.com`,
  password: "test-pass-123",
  ...overrides,
});

// in your test
const user = newUser();
await loginAs(page, user);
```

Each test creates its own data — no shared state between tests.

## Step 4 — waiting strategies

Never `page.waitForTimeout(N)`. Sleeps are flaky and slow.

```typescript
// WRONG
await page.waitForTimeout(2000);

// RIGHT — wait for the thing you actually need
await page.waitForURL(/\/dashboard/);
await page.waitForResponse(r => r.url().includes("/api/checkout"));
await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
```

Playwright auto-waits on most actions. The explicit waits you need are URL changes, network responses, and visibility assertions.

## Step 5 — external service mocking

E2E should hit real internal services but mock external providers (Stripe, Twilio, etc.). Mock at the network layer:

```typescript
await page.route("**/v1/payment_intents", route => {
  route.fulfill({ status: 200, body: JSON.stringify({ id: "pi_test_..." }) });
});
```

Don't mock your own backend in E2E — that's what unit/integration tests are for.

## Step 6 — speed and reliability

- One test = one user flow, end to end. Don't pack three flows into one test.
- Use `test.describe.parallel()` for tests that share no state
- Use `test.beforeEach` for per-test setup, not for shared state setup
- Snapshot tests for visual regression: only on stable, non-animated UI
- Retry: configure `retries: 2` in CI (catches flakes); locally, `retries: 0` (flakes need fixing, not retrying)

## Step 7 — CI conventions

```bash
# Local
npx playwright test
npx playwright test tests/e2e/checkout.spec.ts
npx playwright test --headed              # see what's happening
npx playwright test --debug               # step through

# CI
npx playwright install --with-deps        # set up browsers
npx playwright test --reporter=html       # generates report artifact
```

If the team has a Makefile / npm script like `test:e2e`, use that — don't re-invoke `npx playwright` directly in CI configs you write.

## Anti-patterns to avoid

- `page.waitForTimeout(N)` — flaky and slow
- Hardcoded credentials shared across tests
- One test that depends on another running first
- E2E tests that mock the application backend (use unit/integration for that)
- Tests that depend on production data or production state
- `expect(true).toBe(true)` — placeholder assertions
- Skipping accessibility assertions ("the button is visible AND labelled")

## Before declaring done

- Test passes locally 3 runs in a row (`--repeat-each=3`)
- Test passes against `--workers=1` AND parallel mode
- No `page.waitForTimeout` in the diff
- New page objects added to `tests/pages/`
- CI workflow is green
