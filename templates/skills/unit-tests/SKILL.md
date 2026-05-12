---
name: unit-tests
description: Writing or modifying unit / integration tests. Covers framework detection, the team's test fixtures, mocking patterns, AAA structure, and what NOT to test. Activate for any change to *.test.* / *.spec.* / tests/** files or when the user asks to "add tests" / "improve coverage".
---

# Unit test skill

How this codebase wants unit tests written. Read before adding any `*.test.*` or `*.spec.*` file.

## Step 0 — match the existing framework

NEVER introduce a second test framework. If the repo uses Vitest, don't add Jest. If it uses pytest, don't add unittest.

```bash
# Node — what's installed
grep -E '"(jest|vitest|mocha|tap|node:test)"' package.json

# Python — what's used
grep -E "pytest|unittest" pyproject.toml requirements*.txt setup.py 2>/dev/null

# Go — built-in, no detection needed
ls *_test.go 2>/dev/null | head

# Rust — built-in
grep "#\[test\]" -r src 2>/dev/null | head -3
```

## Step 1 — read existing tests in the module FIRST

Before writing, find an adjacent test file in the same module. Match its style: imports, fixture setup, mocking pattern, naming, assertion style.

```bash
# Find a sibling test
find $(dirname "<file under test>") -name "*.test.*" -o -name "*.spec.*" -o -name "test_*.py" | head -3
```

If the repo has multiple test styles (legacy + new), match the NEW style as evidenced by recent commits.

## Step 2 — AAA structure

```typescript
test("login succeeds with valid credentials", async () => {
  // Arrange
  const user = await createTestUser({ email: "alice@example.com" });

  // Act
  const result = await login(user.email, "correct-password");

  // Assert
  expect(result.token).toBeDefined();
  expect(result.user.id).toBe(user.id);
});
```

One concept per test. If a test name has "and" in it, you probably want two tests.

## Step 3 — what to test, what to skip

| Test | Skip |
|---|---|
| Public functions / exported APIs | Private helpers (test through the public surface) |
| Business logic branches | Trivial getters / one-line wrappers |
| Edge cases (empty, null, max, min) | Trivial happy-path-only coverage |
| Error paths (does it throw the right error?) | Implementation details (which internal fn was called) |
| Bug regressions (a test per fixed bug) | Mock that the mock was called |

## Step 4 — mocking discipline

Mock at module boundaries, not internal calls.

```typescript
// RIGHT — mock the external API client
vi.mock("@/lib/stripe", () => ({ chargeCard: vi.fn() }));

// WRONG — mocking an internal helper from the same module
vi.mock("./calculate-tax", () => ({ calculateTax: vi.fn() }));
```

For tests requiring async: prefer real `await` over mocked promises when the function is short. Mock when the function is slow or external.

## Step 5 — fixtures & factories

If the repo has a test factory (`tests/factories.ts`, `conftest.py` with fixtures, etc.), use it. Don't create a parallel one.

```typescript
// Common pattern — factories in tests/factories.ts
export const userFactory = (overrides = {}) => ({
  id: crypto.randomUUID(),
  email: `test-${Date.now()}@example.com`,
  ...overrides,
});
```

```python
# pytest equivalent
@pytest.fixture
def user(db):
    return User.objects.create(email=f"test-{uuid4()}@example.com")
```

## Step 6 — speed and determinism

Unit tests are fast (<100ms each) and deterministic.

- No real network — mock `fetch` / `requests` / `httpx`
- No real DB unless this is an integration test (different tier)
- No real time — freeze with `vi.useFakeTimers()` / `freezegun` / `time-machine`
- No real randomness — seed RNG / inject mocks
- No `sleep` / `setTimeout` — use fake timers + `vi.advanceTimersByTime`

## Step 7 — naming

Test name describes the behaviour, NOT the function:

```typescript
// RIGHT
test("rejects login when password is expired")
test("returns 422 when email is missing from request body")
test("retries 3 times then gives up when downstream is unreachable")

// WRONG
test("login function")
test("test_login_works")
test("it works")
```

A good test name reads like a spec statement.

## Step 8 — assertion style

Match the repo's assertion library. Don't mix `chai.should()` with `expect()` in the same file.

```typescript
// Vitest / Jest
expect(result).toEqual({ status: "ok" });
expect(() => fn()).toThrow("invalid email");

// pytest
assert result == {"status": "ok"}
with pytest.raises(ValueError, match="invalid email"):
    fn()
```

## Anti-patterns to avoid

- Tests that call `console.log` and require human eyeballing
- Tests that depend on test execution order (use `beforeEach`, not module-level state)
- Tests that mock the very thing they're supposed to verify
- Snapshot tests for highly-volatile structures (large JSON blobs, formatted dates)
- `expect(thing).toBeTruthy()` when `expect(thing).toBe(<exactValue>)` would catch more bugs
- Tests that fail on a Sunday or in a different timezone
- 95% of test code in one massive `beforeEach`

## Bug-fix specific

Every bug fix MUST include a regression test:

1. The test would FAIL before your fix (write it first, see it fail)
2. The test PASSES after your fix
3. Test name references the bug: `// fixes #1234: login fails for emails with +`

This is non-negotiable. A bug fix without a regression test is a recurrence waiting to happen.

## Before declaring done

- `npm test` / `pytest` passes
- Test file is in the same folder as the code it tests (or in `tests/` mirror)
- New tests have descriptive names
- No `.only` / `.skip` left in the diff
- Coverage on the changed lines is meaningful (not "I touched this branch" but "I tested the new logic")
