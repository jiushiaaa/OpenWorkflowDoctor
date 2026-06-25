import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("local deployment files", () => {
  test(".env.example documents local defaults without real secrets", () => {
    const envExample = readProjectFile(".env.example");

    expect(envExample).toContain("OPENWORKFLOWDOCTOR_APP_PORT=3000");
    expect(envExample).toContain("NEXT_PUBLIC_OPENWORKFLOWDOCTOR_DEMO_MODE=true");
    expect(envExample).toContain("Configure n8n and AI providers inside the local browser UI.");
    expect(envExample).not.toContain("OPENWORKFLOWDOCTOR_AI_API_KEY=");
    expect(envExample).not.toContain("OPENWORKFLOWDOCTOR_N8N_API_KEY=");
    expect(envExample).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/u);
    expect(envExample).not.toMatch(/n8n_[A-Za-z0-9_-]{8,}/u);
  });

  test("Docker files exist and do not bake API keys into images", () => {
    for (const relativePath of ["Dockerfile", "docker-compose.yml", ".dockerignore"]) {
      expect(existsSync(path.join(root, relativePath))).toBe(true);
      const contents = readProjectFile(relativePath);
      expect(contents).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/u);
      expect(contents).not.toMatch(/n8n_[A-Za-z0-9_-]{8,}/u);
    }

    const compose = readProjectFile("docker-compose.yml");
    expect(compose).toContain("127.0.0.1:${OPENWORKFLOWDOCTOR_APP_PORT:-3000}:3000");
    expect(compose).not.toMatch(/n8n:/u);
  });

  test("public demo docs cover local trust-boundary checks", () => {
    const checklist = readProjectFile("docs/public-demo-checklist.md");

    expect(checklist).toContain("Demo mode works without n8n");
    expect(checklist).toContain("Demo mode works without AI");
    expect(checklist).toContain("No docs imply hosted SaaS, write-back, or execution");
  });

  test("Dify direct import feasibility docs keep the feature experimental and deferred", () => {
    const feasibility = readProjectFile("docs/dify-readonly-import-feasibility.md");
    const difyDslImport = readProjectFile("docs/dify-dsl-import.md");
    const roadmap = readProjectFile("ROADMAP.md");
    const readme = readProjectFile("README.md");

    expect(feasibility).toContain("experimental");
    expect(feasibility).toContain("deferred");
    expect(feasibility).toContain("Dify DSL YAML import is the stable supported path");
    expect(feasibility).toContain("feature flag");
    expect(feasibility).not.toContain("Dify direct import is currently supported");
    expect(difyDslImport).toContain("YAML import remains the stable supported Dify path");
    expect(difyDslImport).toContain("direct Dify import is intentionally deferred");
    expect(roadmap).toContain("Dify Read-only Import, Experimental");
    expect(roadmap).toContain("Status: deferred");
    expect(readme).toContain("Imports Dify DSL YAML as a local diagnosis-only review copy.");
    expect(readme).not.toContain("Dify direct connection");
    expect(readme).not.toContain("direct Dify connection");
  });

  test("GitHub Actions Docker smoke workflow builds, starts, probes, and cleans up Compose", () => {
    const workflow = readProjectFile(".github/workflows/docker-smoke.yml");

    expect(workflow).toContain("name: Docker Smoke");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("docker compose build");
    expect(workflow).toContain("docker compose up -d");
    expect(workflow).toContain("http://localhost:3000");
    expect(workflow).toContain("OpenWorkflowDoctor");
    expect(workflow).toContain("docker compose ps");
    expect(workflow).toContain("docker compose logs");
    expect(workflow).toContain("docker compose down -v");
    expect(workflow).not.toMatch(/OPENWORKFLOWDOCTOR_.*API_KEY/u);
    expect(workflow).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/u);
    expect(workflow).not.toMatch(/n8n_[A-Za-z0-9_-]{8,}/u);
  });
});
