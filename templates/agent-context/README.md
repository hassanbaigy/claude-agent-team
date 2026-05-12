# Shared Team Learnings

This directory holds accumulated cross-team knowledge discovered during real development sessions — infrastructure gotchas, architecture rules, cross-module patterns, env var requirements.

## How it's maintained

- **Inline by Lead** — Lead captures novel learnings the moment they surface in an agent result. See the Memory Injection Protocol in `.claude/agents/lead.md`.
- **Validation** — after non-trivial tasks, Lead spawns a background scout to verify entries haven't gone stale.

## Tier boundaries

| Tier | Location | Scope | Committed? |
|------|----------|-------|------------|
| 1 — Shared | `.claude/agent-context/` | Helps any developer on this repo | **Yes** |
| 2 — Personal | `.claude/agent-memory-local/lead/` | Helps only this developer | No (gitignored) |

**Promotion test**: "Would this help someone who has NEVER touched this module?" → Tier 1.

## How agents use this

- **Lead** reads these files at the start of non-trivial tasks and injects **file:line references** (not pasted content) into subagent delegation prompts.
- **Subagents do NOT read `agent-context/` directly** — Lead extracts what's relevant and points each agent at it.
- **Every subagent prompt ends with a mandatory acknowledgment block** — the agent must echo back which files it read and the gotchas it found relevant. This makes injection auditable; missing acknowledgment = injection didn't happen.
- Lead is the **single writer**. Subagents propose new learnings in their results; Lead decides what to capture.

## Entry style

- 1-3 lines per bullet. Lead with the rule, then file/function/path references so the entry stays verifiable.
- Validate neighbouring entries when you edit a file — stale references should be fixed or removed inline.

## What goes here

- Module-specific gotchas (`payments.md`, `auth.md`, `webhooks.md`, etc.)
- Infrastructure quirks (`infra-redis.md`, `infra-postgres.md`)
- Architecture rules (`arch-tenant-isolation.md`)
- Cross-module patterns

## What does NOT go here

- Anything derivable from code (file paths, function signatures) — read the code
- Anything in CLAUDE.md — that's the entry point, this is the appendix
- Personal preferences — those go in `agent-memory-local/`
- Raw investigation transcripts — capture the *learning*, not the trail
