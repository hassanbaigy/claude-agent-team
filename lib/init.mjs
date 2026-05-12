// Core install logic for `claude-agent-team init` and `upgrade`.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync, readdirSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectStack } from "./detect.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = resolve(__dirname, "..", "templates");

// Built-in roster presets. Industry presets are loaded from templates/presets/<name>/manifest.json
const ROSTER_PRESETS = {
  minimal: ["lead", "scout", "reviewer", "test-writer"],
  standard: ["lead", "scout", "reviewer", "test-writer", "planner", "investigator", "db-analyst", "ops-scout"],
  full: ["lead", "scout", "reviewer", "test-writer", "planner", "investigator", "db-analyst", "ops-scout", "security-auditor", "frontend-designer"],
};

function loadPreset(presetName) {
  // Roster preset → just a list of agents, no extras
  if (ROSTER_PRESETS[presetName]) {
    return { agents: ROSTER_PRESETS[presetName], industry: null };
  }
  // Industry preset → manifest.json + seeded agent-context files
  const presetDir = join(TEMPLATES, "presets", presetName);
  const manifestPath = join(presetDir, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const seededContextDir = join(presetDir, "agent-context");
  const seededContext = existsSync(seededContextDir)
    ? readdirSync(seededContextDir).filter(f => f.endsWith(".md"))
    : [];
  return {
    agents: manifest.agents,
    description: manifest.description,
    seededContext,
    seededContextDir,
    industry: presetName,
  };
}

// Skills layer
const SKILLS_DIR = join(TEMPLATES, "skills");

export function listAvailableSkills() {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR).filter(name => {
    const p = join(SKILLS_DIR, name, "SKILL.md");
    return existsSync(p);
  }).map(name => {
    const text = readFileSync(join(SKILLS_DIR, name, "SKILL.md"), "utf-8");
    const m = text.match(/^---[\s\S]*?description:\s*([^\n]+)/);
    const desc = m ? m[1].trim() : "";
    return { name, description: desc };
  });
}

// Stack-driven skill auto-suggestion
function suggestSkillsForStack(stack) {
  const suggested = new Set();
  // Universal recommendations
  suggested.add("git-pr-workflow");
  suggested.add("unit-tests");
  // Frontend signals
  if (/Next\.js|React|Vue|Svelte/i.test(stack.framework || "")) {
    suggested.add("frontend-design");
  }
  if (/Playwright/i.test(stack.testRunner || "")) {
    suggested.add("playwright-e2e");
  }
  if (stack.hasDB) suggested.add("database-migrations");
  return [...suggested];
}

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
};

function log(msg) { console.log(msg); }
function done(msg) { log(`${C.green}✓${C.reset} ${msg}`); }
function skip(msg) { log(`${C.dim}·${C.reset} ${C.dim}${msg}${C.reset}`); }
function warn(msg) { log(`${C.yellow}!${C.reset} ${msg}`); }
function info(msg) { log(`${C.blue}ℹ${C.reset} ${msg}`); }

export async function runInit(opts) {
  const cwd = process.cwd();
  const presetName = opts.preset || "standard";
  const preset = loadPreset(presetName);
  if (!preset) {
    throw new Error(`unknown preset "${presetName}". Use minimal | standard | full | saas | healthcare | fintech.`);
  }
  const dryRun = Boolean(opts["dry-run"]);
  const force = Boolean(opts.force);
  const mode = opts.mode; // "init" or "upgrade"

  const projectName = opts.project || basename(cwd);
  const stack = detectStack(cwd);

  log(`${C.bold}claude-agent-team${C.reset} — ${mode === "upgrade" ? "upgrading" : "installing"} in ${C.bold}${projectName}${C.reset}`);
  const seedCount = preset.seededContext ? preset.seededContext.length : 0;
  // skillNames is computed later; precompute here for the summary line
  let _skillCount = 0;
  if (opts.skills === "none" || opts.skills === false) _skillCount = 0;
  else if (opts.skills && opts.skills !== "auto" && opts.skills !== true) _skillCount = String(opts.skills).split(",").filter(Boolean).length;
  else _skillCount = suggestSkillsForStack(stack).length;
  const presetSummary = preset.industry
    ? `preset: ${presetName} (${preset.agents.length} agents + ${seedCount} seeded gotchas + ${_skillCount} skills)`
    : `preset: ${presetName} (${preset.agents.length} agents + ${_skillCount} skills)`;
  log(`${C.dim}${presetSummary} — stack: ${stack.summary}${C.reset}${dryRun ? `  ${C.yellow}[dry-run]${C.reset}` : ""}`);
  if (preset.description) log(`${C.dim}  ${preset.description}${C.reset}`);
  log("");

  const targets = [];

  // 1. .claude/agents/*.md
  for (const agent of preset.agents) {
    const src = join(TEMPLATES, "agents", `${agent}.md`);
    const dst = join(cwd, ".claude", "agents", `${agent}.md`);
    targets.push({ src, dst, kind: "agent", name: agent });
  }

  // 1b. Industry preset: seed agent-context with curated gotchas
  if (preset.seededContext) {
    for (const filename of preset.seededContext) {
      const src = join(preset.seededContextDir, filename);
      const dst = join(cwd, ".claude", "agent-context", filename);
      targets.push({ src, dst, kind: "seeded-context", name: `agent-context/${filename}` });
    }
  }

  // 1c. Skills — explicit --skills=a,b,c OR auto from stack
  let skillNames = [];
  if (opts.skills !== undefined) {
    if (opts.skills === "none" || opts.skills === false) {
      skillNames = [];
    } else if (opts.skills === "auto" || opts.skills === true) {
      skillNames = suggestSkillsForStack(stack);
    } else {
      skillNames = String(opts.skills).split(",").map(s => s.trim()).filter(Boolean);
    }
  } else {
    // default: auto-suggest from stack
    skillNames = suggestSkillsForStack(stack);
  }
  const availableSkills = listAvailableSkills().map(s => s.name);
  for (const skill of skillNames) {
    if (!availableSkills.includes(skill)) {
      warn(`unknown skill "${skill}" — available: ${availableSkills.join(", ")}`);
      continue;
    }
    const src = join(SKILLS_DIR, skill, "SKILL.md");
    const dst = join(cwd, ".claude", "skills", skill, "SKILL.md");
    targets.push({ src, dst, kind: "skill", name: `skills/${skill}/SKILL.md` });
  }

  // 2. .claude/agent-context/README.md
  targets.push({
    src: join(TEMPLATES, "agent-context", "README.md"),
    dst: join(cwd, ".claude", "agent-context", "README.md"),
    kind: "agent-context-readme",
    name: "agent-context/README.md",
  });

  // 3. .claude/agent-memory-local/lead/.gitkeep + MEMORY.md
  targets.push({
    src: join(TEMPLATES, "agent-memory-local", "lead", "MEMORY.md"),
    dst: join(cwd, ".claude", "agent-memory-local", "lead", "MEMORY.md"),
    kind: "memory-local",
    name: "agent-memory-local/lead/MEMORY.md",
  });

  // 4. .claude/settings.json
  if (!opts["no-settings"]) {
    targets.push({
      src: join(TEMPLATES, "settings.json"),
      dst: join(cwd, ".claude", "settings.json"),
      kind: "settings",
      name: ".claude/settings.json",
    });
  }

  // 5. CLAUDE.md (only if user wants it and doesn't already have one)
  if (!opts["no-claude-md"]) {
    const claudeMdPath = join(cwd, "CLAUDE.md");
    if (!existsSync(claudeMdPath)) {
      targets.push({
        src: join(TEMPLATES, "CLAUDE.md.tmpl"),
        dst: claudeMdPath,
        kind: "claude-md",
        name: "CLAUDE.md",
        transform: true,
      });
    }
  }

  // 6. .gitignore patch
  targets.push({
    kind: "gitignore",
    name: ".gitignore (Tier 2 entries)",
    custom: () => patchGitignore(cwd, dryRun),
  });

  // Execute
  let created = 0, kept = 0, overwritten = 0;
  for (const t of targets) {
    if (t.custom) {
      const result = t.custom();
      if (result === "created") { done(t.name); created++; }
      else if (result === "kept") { skip(`${t.name} (already present)`); kept++; }
      continue;
    }

    if (!existsSync(t.src)) {
      warn(`template missing: ${t.src} — skipping`);
      continue;
    }

    const exists = existsSync(t.dst);
    const action = !exists ? "create" : force ? "overwrite" : "skip";

    if (action === "skip") {
      skip(`${t.name} (already present — use --force to overwrite)`);
      kept++;
      continue;
    }

    if (dryRun) {
      info(`would ${action}: ${t.dst.replace(cwd + "/", "")}`);
      continue;
    }

    mkdirSync(dirname(t.dst), { recursive: true });
    let contents = readFileSync(t.src, "utf-8");
    if (t.transform) {
      contents = contents
        .replaceAll("{{PROJECT_NAME}}", projectName)
        .replaceAll("{{LANG}}", stack.language || "unknown")
        .replaceAll("{{FRAMEWORK}}", stack.framework || "unknown")
        .replaceAll("{{TEST_RUNNER}}", stack.testRunner || "unknown")
        .replaceAll("{{PKG_MANAGER}}", stack.packageManager || "unknown");
    }
    writeFileSync(t.dst, contents);
    if (action === "create") { done(t.name); created++; }
    else { done(`${t.name} (overwritten)`); overwritten++; }
  }

  log("");
  log(`${C.bold}Summary${C.reset}`);
  log(`  ${C.green}${created}${C.reset} created   ${C.dim}${kept} kept${C.reset}${overwritten > 0 ? `   ${C.yellow}${overwritten} overwritten${C.reset}` : ""}`);
  log("");

  if (created > 0 || overwritten > 0) {
    log(`${C.bold}Next steps${C.reset}`);
    log(`  1. ${C.bold}cd${C.reset} into the repo and run ${C.bold}claude${C.reset} — the Lead agent will activate automatically.`);
    log(`  2. Try a first prompt: ${C.dim}"map this codebase for me"${C.reset} — Lead spawns scout.`);
    log(`  3. Read ${C.bold}.claude/agents/lead.md${C.reset} to see the Memory Injection Protocol.`);
    log(`  4. ${dryRun ? "Re-run without --dry-run to apply changes." : "Commit the new .claude/ folder to git."}`);
  } else if (mode === "init") {
    log(`${C.dim}Nothing to do — .claude/ is already in place. Use ${C.bold}claude-agent-team upgrade${C.reset}${C.dim} to refresh from templates.${C.reset}`);
  }
}

function patchGitignore(cwd, dryRun) {
  const gi = join(cwd, ".gitignore");
  const marker = "# claude-agent-team — personal/local memory";
  const block = `\n${marker}\n.claude/agent-memory-local/\n.claude/settings.local.json\n`;
  if (!existsSync(gi)) {
    if (dryRun) { info(`would create .gitignore with Tier 2 entries`); return "created"; }
    writeFileSync(gi, block.trimStart());
    return "created";
  }
  const current = readFileSync(gi, "utf-8");
  if (current.includes(marker)) return "kept";
  if (dryRun) { info(`would append Tier 2 entries to .gitignore`); return "created"; }
  writeFileSync(gi, current.endsWith("\n") ? current + block : current + "\n" + block);
  return "created";
}
