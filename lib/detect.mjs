// Lightweight stack detection. Reads a few well-known files to decide
// language / framework / package manager / test runner.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function tryRead(path) {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

function tryJSON(path) {
  const raw = tryRead(path);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function detectStack(cwd) {
  const out = {
    language: null,
    framework: null,
    packageManager: null,
    testRunner: null,
    hasDocker: existsSync(join(cwd, "Dockerfile")) || existsSync(join(cwd, "docker-compose.yml")),
    hasK8s: existsSync(join(cwd, "k8s")) || existsSync(join(cwd, "helm")) || existsSync(join(cwd, "kustomization.yaml")),
    hasTerraform: existsSync(join(cwd, "terraform")) || existsSync(join(cwd, "infra")),
    hasDB: existsSync(join(cwd, "prisma")) || existsSync(join(cwd, "migrations")) || existsSync(join(cwd, "alembic")),
  };

  // Node / JS / TS
  const pkg = tryJSON(join(cwd, "package.json"));
  if (pkg) {
    out.language = existsSync(join(cwd, "tsconfig.json")) ? "TypeScript" : "JavaScript";
    out.packageManager =
      existsSync(join(cwd, "pnpm-lock.yaml")) ? "pnpm" :
      existsSync(join(cwd, "yarn.lock")) ? "yarn" :
      existsSync(join(cwd, "bun.lockb")) ? "bun" : "npm";
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps.next) out.framework = "Next.js";
    else if (deps["@nestjs/core"]) out.framework = "NestJS";
    else if (deps.express) out.framework = "Express";
    else if (deps.fastify) out.framework = "Fastify";
    else if (deps.react) out.framework = "React";
    else if (deps.vue) out.framework = "Vue";
    if (deps.jest) out.testRunner = "Jest";
    else if (deps.vitest) out.testRunner = "Vitest";
    else if (deps["@playwright/test"]) out.testRunner = out.testRunner ? `${out.testRunner} + Playwright` : "Playwright";
    else if (deps.mocha) out.testRunner = "Mocha";
  }

  // Python
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "requirements.txt")) || existsSync(join(cwd, "setup.py"))) {
    out.language = out.language ? `${out.language} + Python` : "Python";
    const py = tryRead(join(cwd, "pyproject.toml")) || tryRead(join(cwd, "requirements.txt")) || "";
    if (/fastapi/i.test(py)) out.framework = out.framework || "FastAPI";
    else if (/django/i.test(py)) out.framework = out.framework || "Django";
    else if (/flask/i.test(py)) out.framework = out.framework || "Flask";
    else if (/frappe/i.test(py)) out.framework = out.framework || "Frappe";
    if (/pytest/i.test(py)) out.testRunner = out.testRunner || "pytest";
    if (!out.packageManager) {
      out.packageManager =
        existsSync(join(cwd, "uv.lock")) ? "uv" :
        existsSync(join(cwd, "poetry.lock")) ? "poetry" :
        existsSync(join(cwd, "Pipfile.lock")) ? "pipenv" : "pip";
    }
  }

  // Go
  if (existsSync(join(cwd, "go.mod"))) {
    out.language = out.language ? `${out.language} + Go` : "Go";
    out.packageManager = out.packageManager || "go modules";
    out.testRunner = out.testRunner || "go test";
  }

  // Rust
  if (existsSync(join(cwd, "Cargo.toml"))) {
    out.language = out.language ? `${out.language} + Rust` : "Rust";
    out.packageManager = out.packageManager || "cargo";
    out.testRunner = out.testRunner || "cargo test";
  }

  // Ruby
  if (existsSync(join(cwd, "Gemfile"))) {
    out.language = out.language ? `${out.language} + Ruby` : "Ruby";
    out.packageManager = out.packageManager || "bundler";
    const gf = tryRead(join(cwd, "Gemfile")) || "";
    if (/rails/i.test(gf)) out.framework = out.framework || "Rails";
    if (/rspec/i.test(gf)) out.testRunner = out.testRunner || "RSpec";
  }

  if (!out.language) out.language = "unknown";

  // Summary line for logs
  const parts = [out.language];
  if (out.framework) parts.push(out.framework);
  if (out.packageManager) parts.push(out.packageManager);
  if (out.testRunner) parts.push(out.testRunner);
  out.summary = parts.join(" / ");

  return out;
}
