#!/usr/bin/env node
// claude-agent-team — drop a Claude Code agent team into any repo.
// Zero dependencies, pure Node stdlib. Works under `npx`.

import { runInit } from "../lib/init.mjs";
import { runDoctor } from "../lib/doctor.mjs";
import { runSkills } from "../lib/skills.mjs";

const ARGS = process.argv.slice(2);
const CMD = ARGS[0];
const FLAGS = parseFlags(ARGS.slice(1));

const HELP = `claude-agent-team — install the Memory Injection Protocol + Lead/specialist agent team into any repo.

Usage:
  npx claude-agent-team <command> [options]

Commands:
  init           Scaffold .claude/ in the current repo (idempotent)
  upgrade        Re-run init with merge: pulls new templates, preserves your edits
  doctor         Inspect the current .claude/ setup and report status
  skills         Manage skills — list / add / remove
  help           Show this message

Options for \`init\` / \`upgrade\`:
  --preset=<name>                    Agent roster preset (default: standard)
  --skills=<a,b,c|auto|none>         Skills to install (default: auto-suggest from stack)
  --force                            Overwrite existing files (dangerous)
  --dry-run                          Show what would change without writing
  --project=<name>                   Project name for CLAUDE.md (defaults to repo dir)
  --no-claude-md                     Skip writing CLAUDE.md
  --no-settings                      Skip writing .claude/settings.json

Roster presets (no seeded memory):
  minimal     lead, scout, reviewer, test-writer
  standard    + planner, investigator, db-analyst, ops-scout
  full        + security-auditor, frontend-designer

Industry presets (full roster + curated agent-context gotchas):
  saas        Multi-tenant SaaS — tenant isolation, OAuth, webhooks, billing
  healthcare  HIPAA — PHI redaction, audit trails, clinic-level isolation
  fintech     Money invariants, idempotency, audit events, KYC/PII handling

Skills (procedures the agents read before doing recurring operations):
  frontend-design        Design-system reuse, a11y, responsive
  playwright-e2e         E2E test patterns, page objects, waits
  unit-tests             Framework match, AAA, mocking discipline
  database-migrations    Zero-downtime, index safety, backfills, rollback
  git-pr-workflow        Branch / commit / PR conventions

Examples:
  cd my-repo && npx claude-agent-team init
  npx claude-agent-team init --preset=saas --skills=frontend-design,unit-tests
  npx claude-agent-team init --preset=healthcare
  npx claude-agent-team skills list
  npx claude-agent-team skills add database-migrations
  npx claude-agent-team doctor

Memory Injection Protocol docs: https://github.com/hassanbaig/claude-agent-team
`;

function parseFlags(args) {
  const out = { _: [] };
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [k, v] = arg.slice(2).split("=");
      out[k] = v === undefined ? true : v;
    } else if (arg.startsWith("-")) {
      out[arg.slice(1)] = true;
    } else {
      out._.push(arg);
    }
  }
  return out;
}

async function main() {
  switch (CMD) {
    case "init":
      await runInit({ ...FLAGS, mode: "init" });
      break;
    case "upgrade":
      await runInit({ ...FLAGS, mode: "upgrade" });
      break;
    case "doctor":
      await runDoctor(FLAGS);
      break;
    case "skills":
      await runSkills(FLAGS);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${CMD}\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nclaude-agent-team: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
