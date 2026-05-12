---
name: git-pr-workflow
description: Creating commits, branches, or pull requests in this repo. Covers branch naming, commit message format, PR description structure, and pre-merge checks. Activate for any task involving git, commits, PRs, or `gh` commands.
---

# Git / PR workflow skill

How this codebase wants changes proposed and merged. Read before opening any PR.

## Step 0 — detect the host + default branch

```bash
git remote -v
# github.com → use gh
# *.ghe.com → GitHub Enterprise, gh still works but case in URLs matters
# gitlab.com / *.gitlab.* → use glab

git branch --show-current
git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'
# the default branch is often "main" but may be "master", "dev", "develop", "trunk"
```

PR target = the default branch the repo's protected-branch rules expect. NOT necessarily `main`. Check `CONTRIBUTING.md` or recent merged PRs for the canonical target.

## Step 1 — branch naming

Reuse the convention already in the repo:

```bash
git branch -a --sort=-committerdate | head -20
```

Common conventions:

| Convention | Example |
|---|---|
| `feat/<slug>` / `fix/<slug>` / `chore/<slug>` | `feat/checkout-discount-codes` |
| `<username>/<slug>` | `alice/checkout-discount` |
| `<issue-number>-<slug>` | `1247-checkout-discount` |
| Conventional + issue | `fix/1247-login-timeout` |

Branch off the default branch, not off your last feature branch:

```bash
git fetch origin
git checkout -b feat/<slug> origin/main   # or origin/dev — whichever is canonical
```

## Step 2 — commit message format

Most repos use Conventional Commits:

```
<type>(<scope>): <subject>

<body — optional, wrapping at 72 chars>

<footer — optional>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`, `build`, `ci`, `revert`.

```
feat(checkout): support multi-currency discount codes

Adds a `currency` column to discount_codes; existing rows default to USD.
The checkout flow now rejects mismatched-currency codes with a 422.

Closes #1247
```

Rules:
- Subject line: imperative ("add", not "added"), no trailing period, < 70 chars
- Capitalize the subject after the colon only if the repo's existing commits do
- Body explains WHY, not WHAT (the diff shows what)
- Reference issues in the footer

Check the repo's recent commits for tone and scope conventions:

```bash
git log --oneline -20
```

## Step 3 — small, atomic commits

One logical change per commit. If your commit message has "and" in it, split it.

```bash
# Multiple unrelated changes in working tree
git add -p   # interactively stage hunks, splitting by concern

# Or per-file
git add path/to/file1.ts
git commit -m "fix(scope): one thing"
git add path/to/file2.ts
git commit -m "feat(scope): different thing"
```

## Step 4 — pre-commit checks (RUN BEFORE PUSHING)

Find the project's check commands:

```bash
# Node
cat package.json | grep -E '"(lint|test|typecheck|build|check)"' | head -10

# Python
ls -la .pre-commit-config.yaml ruff.toml pyproject.toml 2>/dev/null
```

Run them. Don't push code that fails CI — it wastes minutes and review attention. Typical baseline:

```bash
npm run lint && npm run typecheck && npm test
# OR
pre-commit run --all-files && pytest
```

If the repo has a `Makefile` or `justfile` with a `check` target, use that.

## Step 5 — PR description structure

Most repos converge on this skeleton:

```markdown
## Summary
<1-3 bullet points: what changes, why>

## Test plan
- [ ] <thing you tested>
- [ ] <regression test added>
- [ ] <manual smoke step>

## Risk / rollback
<what could go wrong, how to undo>

## Linked issues
Closes #1247
```

Tailor to what the repo's existing PRs look like — `gh pr list --state merged --limit 5 --json title,body | jq` is a quick way to learn the convention.

## Step 6 — destructive operations require review

For PRs that touch:
- Migrations (especially destructive ones — see `database-migrations` skill)
- Auth / authz logic
- Public API surface (breaking changes)
- Production config / secrets handling
- Deployment / infrastructure code

…the PR body MUST include an explicit risk section and SHOULD be tagged so the right reviewer is auto-assigned.

## Step 7 — opening the PR

```bash
git push -u origin <branch-name>
gh pr create \
  --base <default-branch> \
  --title "<type>(<scope>): <subject>" \
  --body-file .pr-template.md   # OR --body "<content>"
```

For GitHub Enterprise (host like `*.ghe.com`):
- `gh` normalizes the host to lowercase — `gh repo view org/repo` works even if remote URL has mixed case
- Some `gh auth` commands require `--hostname` matching the lowercase form

## Step 8 — addressing review

- Push commits, don't force-push, while review is in progress (reviewers want to see new changes, not rebased history)
- Once approved + about to merge: squash if the repo prefers squash, otherwise leave history as-is
- Reply to every review comment, even "fixed in <commit-sha>" — silent resolution is rude

## Anti-patterns to avoid

- Force-pushing during active review
- Mixing refactor + feature in one PR
- PR descriptions that are just "see commit messages"
- Skipping the test plan section
- Opening a PR with failing CI ("I'll fix it after review")
- Branching off your previous feature branch (creates dependency chains)
- Committing to `main` directly
- `git push --no-verify` to bypass hooks — fix the hook failure, don't skip it

## Before declaring done (the PR-author's checklist)

- All commits follow the format
- Branch is rebased on / merged with the latest default branch
- Lint + typecheck + test all pass locally
- Test plan items in PR description are checked off
- PR description has a risk/rollback note if applicable
- Self-review of the diff: did I leave debug logs? .only/.skip in tests? hard-coded secrets?

If any of these fail, the PR isn't ready.
