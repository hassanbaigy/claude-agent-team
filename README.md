# claude-agent-team

> Drop a battle-tested Claude Code agent team into any repo, in one command.

```bash
cd your-repo
npx claude-agent-team init
```

That's it. You now have:

- A **Lead** coordinator agent (Opus) that auto-delegates to specialists
- 8+ specialist agents — scout, planner, investigator, reviewer, test-writer, db-analyst, ops-scout, security-auditor, frontend-designer
- The **Memory Injection Protocol** — a mandatory three-step cycle (Inject / Capture / Validate) that keeps your team's accumulated knowledge from rotting between sessions
- A shared `.claude/agent-context/` memory store, with the contract that subagents can only read it and Lead is the single writer
- **Industry presets** that pre-seed your memory with the gotchas every team in your vertical hits
- **Skills** — procedural how-to documents the agents read before doing recurring operations (migrations, components, tests, PRs)

## Why this exists

Every Claude Code session starts from zero. The same gotchas get rediscovered. The same wrong paths get walked. Multiply that across a team and you're paying for the same investigation tens of times a month.

This package codifies a protocol that's been running in a production repo for weeks:

- **13 engineers** contributing to shared agent memory
- **198 commits** across 30 topic files in a 14-day window
- The enforcement mechanism — **every subagent must echo back an acknowledgment** of which memory files it read — makes injection auditable instead of aspirational

## Quick start

```bash
# Generic — just the agent team, no pre-seeded gotchas
npx claude-agent-team init

# Industry preset — agents + curated gotchas your team will hit on day one
npx claude-agent-team init --preset=saas        # multi-tenant SaaS
npx claude-agent-team init --preset=healthcare  # HIPAA-aware
npx claude-agent-team init --preset=fintech     # money invariants + audit
```

Then:

```bash
claude
> who are you and what's in this repo?
```

Lead activates as the default agent, lists the team, and offers delegation paths.

## Industry presets

Each preset installs the full specialist roster AND pre-seeds `.claude/agent-context/` with curated gotcha files for that domain.

### `--preset=saas`

For multi-tenant SaaS — bills users, has OAuth integrations, receives webhooks, owns user-generated data.

Seeded gotchas:
- **arch-multi-tenancy.md** — tenant scoping rules, query patterns, cross-tenant boundaries
- **webhooks.md** — HMAC verification (fail-closed), idempotency, replay windows
- **oauth.md** — state validation, PKCE, redirect URI exact-match, token storage
- **billing.md** — Stripe idempotency, integer money, dunning state machines, charge-after-persist

### `--preset=healthcare`

HIPAA-aware. Everything in `saas` plus:

Seeded gotchas:
- **hipaa-rules.md** — the 18 Safe Harbor PHI identifiers, BAAs, encryption requirements, retention
- **phi-redaction.md** — whitelist > blacklist, logger filters, error message hygiene, Sentry scrubbing
- **audit-trail.md** — event shape, append-only enforcement, §164.308 retention, real audit queries to pre-build

### `--preset=fintech`

For money-moving systems — payments, banking, crypto, lending.

Seeded gotchas:
- **money-invariants.md** — integer minor units (never floats), currency on every amount, banker's rounding, decimal math
- **audit-events.md** — append-only ledger, write-before-call pattern, regulatory retention windows
- **idempotency.md** — every money endpoint requires it, server-side storage shape, replay handling
- **pii-handling.md** — PCI scope avoidance, KYC document storage, data subject rights

## Skills (v0.3+)

Skills are procedural how-to documents that agents read before doing recurring operations. The installer auto-detects which skills your stack needs and installs them. You can also pick explicitly with `--skills=...`.

| Skill | What it covers |
|---|---|
| `frontend-design` | Design-system reuse, accessibility, responsive defaults, loading/empty/error states |
| `playwright-e2e` | Session helpers, Page Objects, test data factories, waiting strategies |
| `unit-tests` | Framework detection, AAA structure, mocking discipline, fixture conventions |
| `database-migrations` | Zero-downtime patterns, index safety, backfill ordering, rollback testing |
| `git-pr-workflow` | Branch naming, commit format, PR description, pre-merge checks |

```bash
npx claude-agent-team skills list                       # see what's available
npx claude-agent-team init --skills=auto                # let stack detection pick (default)
npx claude-agent-team init --skills=frontend-design,unit-tests   # pick explicit
npx claude-agent-team skills add database-migrations    # add post-install
npx claude-agent-team skills remove playwright-e2e      # remove
```

**Agent-context vs Skills**: agent-context = *gotchas to AVOID* (rules). Skills = *procedures to FOLLOW* (recipes). Both are subject to the Memory Injection Protocol — Lead injects relevant ones into subagent prompts.

## What it installs

```
.claude/
├── agents/
│   ├── lead.md              # Coordinator + Memory Injection Protocol
│   ├── scout.md             # Haiku, read-only exploration
│   ├── reviewer.md          # Sonnet, code review
│   ├── investigator.md      # Opus, bug investigation
│   ├── planner.md           # Sonnet, lean design
│   ├── test-writer.md       # Sonnet, tests
│   ├── db-analyst.md        # Sonnet, DB
│   ├── ops-scout.md         # Sonnet, infra
│   ├── security-auditor.md  # Sonnet, security
│   └── frontend-designer.md # Opus, UI (with preset=full)
├── agent-context/
│   ├── README.md            # The memory store contract
│   └── *.md                 # Seeded gotchas from your industry preset
├── skills/
│   └── <skill-name>/SKILL.md  # Procedural how-to docs
├── agent-memory-local/
│   └── lead/MEMORY.md       # Lead's personal memory (gitignored)
└── settings.json            # Activates Lead as default + agent-teams flag

CLAUDE.md                    # Project entry point (only created if absent)
.gitignore                   # Patched to exclude agent-memory-local/
```

## Commands

```bash
# Install (idempotent — never clobbers existing files without --force)
npx claude-agent-team init [--preset=<name>]

# Re-pull templates without clobbering edits
npx claude-agent-team upgrade

# Show what would change without writing
npx claude-agent-team upgrade --dry-run

# Inspect current setup, report drift
npx claude-agent-team doctor

# Help
npx claude-agent-team help
```

## All presets

| Preset | Roster | Seeded memory | When to use |
|--------|--------|---------------|-------------|
| `minimal` | lead + 3 | none | Small library, solo project |
| `standard` (default) | lead + 7 | none | Most app repos |
| `full` | lead + 9 | none | Multi-tenant + UI repos |
| `saas` | lead + 8 | 4 files | Multi-tenant SaaS, any vertical |
| `healthcare` | lead + 8 | 3 files | HIPAA-regulated products |
| `fintech` | lead + 8 | 4 files | Payments, banking, crypto, lending |

## The Memory Injection Protocol

The whole package is built around this. It has three mandatory steps:

### Inject (before every delegation)

Lead reads the relevant files in `.claude/agent-context/` and passes **file:line references** (not pasted text) into subagent prompts. Every prompt ends with:

```
## Context acknowledgment
Before starting work, list which `.claude/agent-context/` files you read
and the key gotchas you found relevant. If none were referenced, state
"No context files injected." This acknowledgment is mandatory.
```

If the agent doesn't acknowledge, injection didn't happen.

### Capture (after every agent result)

Lead scans the result for non-obvious learnings — module gotchas, infrastructure quirks, root causes that would bite someone again — and writes them to `.claude/agent-context/{topic}.md` as 1-3-line bullets. Stale entries get fixed inline during the same edit.

### Validate (after every non-trivial task)

Lead spawns a background scout (`run_in_background: true`) that reads every other file in `.claude/agent-context/` and verifies the bullets still match reality — paths exist, function names still resolve, env vars are still set. Stale entries get flagged and fixed.

## Smart adaptations

The installer reads your repo's manifest files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`) and:

- Detects language, framework, package manager, test runner
- Fills `CLAUDE.md` with the right command stubs
- Notes the stack in the install summary

## Requirements

- Node 18+ (for `npx`)
- [Claude Code](https://claude.ai/code) installed (the `claude` CLI)
- An Anthropic account with a plan that supports Claude Opus (Lead) and Sonnet/Haiku (specialists)

## Roadmap

- `memory validate` — CLI-native staleness check (no LLM required)
- `memory stats` — team-health dashboard
- `add` / `remove` agents — surgical changes after install
- `--integrations=k8s,sentry,grafana,aws-logs` — wire MCP servers + agent prompts so investigator can pull live observability data
- More skills — `feature-flags`, `error-handling`, `temporal-workflows`, framework-specific (`nextjs-app-router`, `nestjs-modules`, `fastapi-routers`)
- GitHub Action — run `memory validate` on every PR

## License

MIT
