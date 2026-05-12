// `claude-agent-team skills list / add / remove` command.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listAvailableSkills } from "./init.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(__dirname, "..", "templates");
const SKILLS_DIR = join(TEMPLATES, "skills");

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", blue: "\x1b[34m",
};

function ok(msg)   { console.log(`${C.green}✓${C.reset} ${msg}`); }
function bad(msg)  { console.log(`${C.red}✗${C.reset} ${msg}`); }
function warn(msg) { console.log(`${C.yellow}!${C.reset} ${msg}`); }
function info(msg) { console.log(`${C.dim}·${C.reset} ${msg}`); }

export async function runSkills(opts) {
  const sub = opts._[0]; // skills <list|add|remove>
  switch (sub) {
    case "list":
    case undefined:
      return runList();
    case "add":
      return runAdd(opts._.slice(1));
    case "remove":
    case "rm":
      return runRemove(opts._.slice(1));
    default:
      console.error(`Unknown skills command: ${sub}\nUse: claude-agent-team skills <list|add|remove>`);
      process.exit(1);
  }
}

function runList() {
  const cwd = process.cwd();
  const installedDir = join(cwd, ".claude", "skills");
  const installed = existsSync(installedDir)
    ? readdirSync(installedDir).filter(f => existsSync(join(installedDir, f, "SKILL.md")))
    : [];
  const available = listAvailableSkills();

  console.log(`${C.bold}Available skills${C.reset} ${C.dim}(in this version of claude-agent-team)${C.reset}\n`);
  for (const s of available) {
    const status = installed.includes(s.name) ? `${C.green}[installed]${C.reset}` : `${C.dim}[not installed]${C.reset}`;
    console.log(`${C.bold}${s.name}${C.reset}  ${status}`);
    console.log(`${C.dim}  ${s.description}${C.reset}`);
    console.log("");
  }
  console.log(`Add a skill: ${C.bold}npx claude-agent-team skills add <name>${C.reset}`);
  console.log(`Remove:      ${C.bold}npx claude-agent-team skills remove <name>${C.reset}`);
}

function runAdd(names) {
  if (names.length === 0) {
    bad("specify at least one skill: claude-agent-team skills add <name> [...]");
    process.exit(1);
  }
  const cwd = process.cwd();
  if (!existsSync(join(cwd, ".claude"))) {
    bad(".claude/ not found — run `claude-agent-team init` first.");
    process.exit(1);
  }
  const available = listAvailableSkills().map(s => s.name);
  for (const name of names) {
    if (!available.includes(name)) {
      warn(`unknown skill "${name}" — available: ${available.join(", ")}`);
      continue;
    }
    const src = join(SKILLS_DIR, name, "SKILL.md");
    const dst = join(cwd, ".claude", "skills", name, "SKILL.md");
    if (existsSync(dst)) {
      info(`${name} already installed — skipping (use \`upgrade --force\` to overwrite)`);
      continue;
    }
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, readFileSync(src, "utf-8"));
    ok(`added skills/${name}/SKILL.md`);
  }
}

function runRemove(names) {
  if (names.length === 0) {
    bad("specify at least one skill: claude-agent-team skills remove <name> [...]");
    process.exit(1);
  }
  const cwd = process.cwd();
  for (const name of names) {
    const dir = join(cwd, ".claude", "skills", name);
    if (!existsSync(dir)) {
      info(`${name} is not installed`);
      continue;
    }
    rmSync(dir, { recursive: true });
    ok(`removed skills/${name}/`);
  }
}
