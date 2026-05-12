#!/usr/bin/env node
// claude-agent-team — drop a Claude Code agent team into any repo.
// Zero dependencies, pure Node stdlib. Works under `npx`.

import { runInit } from "../lib/init.mjs";
import { runDoctor } from "../lib/doctor.mjs";

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
  help           Show this message

Options for \`init\` / \`upgrade\`:
  --preset=<minimal|standard|full>   Agent roster size (default: standard)
  --force                            Overwrite existing files (dangerous)
  --dry-run                          Show what would change without writing
  --project=<name>                   Project name for CLAUDE.md (defaults to repo dir)
  --no-claude-md                     Skip writing CLAUDE.md
  --no-settings                      Skip writing .claude/settings.json

Roster presets:
  minimal   lead, scout, reviewer, test-writer
  standard  + planner, investigator, db-analyst, ops-scout
  full      + security-auditor, frontend-designer

Examples:
  cd my-repo && npx claude-agent-team init
  npx claude-agent-team init --preset=full --project="My API"
  npx claude-agent-team doctor
  npx claude-agent-team upgrade --dry-run

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
