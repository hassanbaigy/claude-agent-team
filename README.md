# claude-agent-team

> Drop a battle-tested Claude Code agent team into any repo, in one command.

```bash
cd your-repo
npx claude-agent-team init
```

That's it. You now have:

- A **Lead** coordinator agent (Opus) that auto-delegates to specialists
- 7+ specialist agents — scout, planner, investigator, reviewer, test-writer, db-analyst, ops-scout, security-auditor, frontend-designer
- The **Memory Injection Protocol** — a mandatory three-step cycle (Inject / Capture / Validate) that keeps your team's accumulated knowledge from rotting between sessions
- A shared `.claude/agent-context/` memory store, with the contract that subagents can only read it and Lead is the single writer

## Why this exists

Every Claude Code session starts from zero. The same gotchas get rediscovered. The same wrong paths get walked. Multiply that across a team and you're paying for the same investigation tens of times a month.

This package codifies a protocol that's been running in a production repo for weeks:

- **13 engineers** contributing to shared agent memory
- **198 commits** across 30 topic files in a 14-day window
- The protocol's enforcement mechanism — **every subagent must echo back an acknowledgment** of which memory files it read — makes injection auditable instead of aspirational

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
│   ├── security-auditor.md  # Sonnet, security (preset=full)
│   └── frontend-designer.md # Opus, UI (preset=full)
├── agent-context/
│   └── README.md            # The memory store contract
├── agent-memory-local/
│   └── lead/MEMORY.md       # Lead's personal memory (gitignored)
└── settings.json            # Activates Lead as default + agent-teams flag

CLAUDE.md                    # Project entry point (only created if absent)
.gitignore                   # Patched to exclude agent-memory-local/
```

## Commands

```bash
npx claude-agent-team init                    # install (idempotent)
npx claude-agent-team init --preset=full      # include security-auditor + frontend-designer
npx claude-agent-team init --preset=minimal   # just lead + scout + reviewer + test-writer
npx claude-agent-team upgrade                 # re-pull templates without clobbering edits
npx claude-agent-team upgrade --force         # overwrite local changes (dangerous)
npx claude-agent-team upgrade --dry-run       # show what would change
npx claude-agent-team doctor                  # inspect current setup, report drift
```

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

## Roster presets

| Preset | Agents | When to use |
|--------|--------|-------------|
| `minimal` | lead, scout, reviewer, test-writer | Small library, solo project |
| `standard` (default) | + planner, investigator, db-analyst, ops-scout | Most app repos |
| `full` | + security-auditor, frontend-designer | Multi-tenant SaaS, anything with a UI |

You can also pick agents à la carte by editing the install — each agent is a standalone `.md` file.

## Smart adaptations

The installer reads your repo's manifest files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`) and:

- Detects language, framework, package manager, test runner
- Fills `CLAUDE.md` with the right command stubs
- Notes the stack in the install summary

## Requirements

- Node 18+ (for `npx`)
- [Claude Code](https://claude.ai/code) installed (the `claude` CLI)
- An Anthropic account with a plan that supports Claude Opus (Lead) and Claude Sonnet/Haiku (specialists)

## License

MIT
