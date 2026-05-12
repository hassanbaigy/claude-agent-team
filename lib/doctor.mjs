// Inspects the current .claude/ setup and reports.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { detectStack } from "./detect.mjs";

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", blue: "\x1b[34m",
};

function ok(msg) { console.log(`${C.green}✓${C.reset} ${msg}`); }
function bad(msg) { console.log(`${C.red}✗${C.reset} ${msg}`); }
function warn(msg) { console.log(`${C.yellow}!${C.reset} ${msg}`); }
function info(msg) { console.log(`${C.dim}·${C.reset} ${msg}`); }

export async function runDoctor() {
  const cwd = process.cwd();
  const stack = detectStack(cwd);
  console.log(`${C.bold}claude-agent-team doctor${C.reset} — ${cwd}`);
  console.log(`${C.dim}stack: ${stack.summary}${C.reset}\n`);

  let issues = 0;

  // 1. .claude/ exists
  const claudeDir = join(cwd, ".claude");
  if (!existsSync(claudeDir)) {
    bad(".claude/ not found — run `npx claude-agent-team init`");
    return;
  }
  ok(".claude/ present");

  // 2. agents/
  const agentsDir = join(claudeDir, "agents");
  if (!existsSync(agentsDir)) {
    bad("agents/ missing");
    issues++;
  } else {
    const agents = readdirSync(agentsDir).filter(f => f.endsWith(".md"));
    ok(`agents/ — ${agents.length} agent file(s)`);
    if (!agents.includes("lead.md")) { bad("  missing lead.md — Lead is mandatory"); issues++; }
    else {
      const leadContent = readFileSync(join(agentsDir, "lead.md"), "utf-8");
      if (!leadContent.includes("Memory Injection Protocol")) {
        warn("  lead.md missing Memory Injection Protocol section — run `upgrade` to refresh");
        issues++;
      } else {
        info("  lead.md has Memory Injection Protocol");
      }
    }
  }

  // 3. agent-context/
  const ctxDir = join(claudeDir, "agent-context");
  if (!existsSync(ctxDir)) {
    warn("agent-context/ missing — memory store not initialized");
    issues++;
  } else {
    const ctxFiles = readdirSync(ctxDir).filter(f => f.endsWith(".md"));
    ok(`agent-context/ — ${ctxFiles.length} file(s)`);
  }

  // 4. settings.json
  const settings = join(claudeDir, "settings.json");
  if (!existsSync(settings)) {
    warn("settings.json missing — Lead won't be the default agent");
    issues++;
  } else {
    const s = JSON.parse(readFileSync(settings, "utf-8"));
    if (s.agent === "lead") ok("settings.json — Lead is the default agent");
    else { warn(`settings.json — default agent is "${s.agent}", not "lead"`); issues++; }
    if (s.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === "1") ok("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1");
    else { warn("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS not set — agent teams may not activate"); issues++; }
  }

  // 5. .gitignore for Tier 2
  const gi = join(cwd, ".gitignore");
  if (existsSync(gi)) {
    const giContent = readFileSync(gi, "utf-8");
    if (giContent.includes("agent-memory-local")) ok(".gitignore excludes agent-memory-local/ (Tier 2)");
    else { warn(".gitignore does not exclude agent-memory-local/ — personal memory may leak into commits"); issues++; }
  }

  console.log("");
  if (issues === 0) console.log(`${C.green}${C.bold}All systems go.${C.reset}`);
  else console.log(`${C.yellow}${C.bold}${issues} issue(s).${C.reset} Run ${C.bold}claude-agent-team upgrade${C.reset} to refresh from latest templates.`);
}
