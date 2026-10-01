/**
 * spec-gen.ts
 *
 * Fetches a GitHub issue from Designerpro13/hb-frontend and generates the
 * three Kiro spec files (requirements.md, design.md, tasks.md) under
 * .kiro/specs/issue-fix/.
 *
 * Usage: tsx src/spec-gen.ts <issue-number>
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Octokit } from "@octokit/rest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: Array<{ name: string | undefined }>;
  user: { login: string } | null;
  created_at: string;
}

export interface SpecFiles {
  requirements: string;
  design: string;
  tasks: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[getGITfixed] Required environment variable ${key} is not set. ` +
        `Copy .env.example to .env and fill in the value.`,
    );
  }
  return value;
}

function log(message: string): void {
  console.info(`[getGITfixed] ${message}`);
}

// ---------------------------------------------------------------------------
// GitHub issue fetcher
// ---------------------------------------------------------------------------

export async function fetchIssue(
  issueNumber: number,
  owner = "Designerpro13",
  repo = "hb-frontend",
): Promise<GitHubIssue> {
  const token = getEnv("GITHUB_TOKEN");
  const octokit = new Octokit({ auth: token });

  log(`Fetching issue #${issueNumber} from ${owner}/${repo}…`);

  const response = await octokit.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const issue = response.data;
  log(`Fetched: "${issue.title}"`);

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? null,
    html_url: issue.html_url,
    labels: issue.labels.map((l) => ({
      name: typeof l === "string" ? l : l.name,
    })),
    user: issue.user ? { login: issue.user.login } : null,
    created_at: issue.created_at,
  };
}

// ---------------------------------------------------------------------------
// Spec content generators
// ---------------------------------------------------------------------------

export function generateRequirements(issue: GitHubIssue): string {
  const issueNum = String(issue.number);
  const labelNames = issue.labels.map((l) => l.name ?? "").filter(Boolean);
  const labelStr = labelNames.length > 0 ? labelNames.join(", ") : "security";

  return `---
specId: issue-${issueNum}
issueNumber: ${issueNum}
issueUrl: ${issue.html_url}
generatedAt: ${new Date().toISOString()}
---

# Requirements: ${issue.title}

## Background

This spec was auto-generated from GitHub issue #${issueNum} in
[Designerpro13/hb-frontend](https://github.com/Designerpro13/hb-frontend).

**Issue labels:** ${labelStr}
**Opened by:** ${issue.user?.login ?? "unknown"}
**Opened at:** ${issue.created_at}

## Problem Statement

${issue.body ?? "_No description provided in the issue._"}

## User Story

> As a user of hb-frontend, the application should **not** expose the vulnerability
> described in issue #${issueNum}, so that my account and data remain secure.

## Acceptance Criteria

- [ ] AC-1: The vulnerability described in issue #${issueNum} is fully remediated
- [ ] AC-2: Existing tests continue to pass after the fix
- [ ] AC-3: New tests are added that directly verify the fix
- [ ] AC-4: No new security warnings are introduced by the change
- [ ] AC-5: The fix follows the patterns in \`.kiro/steering/security-fix-patterns.md\`

## Out of Scope

- Refactoring code unrelated to the security issue
- Changes to CI/CD pipeline
- Updating third-party dependencies unless directly required by the fix

## References

- Issue: ${issue.html_url}
- OWASP Top 10: https://owasp.org/www-project-top-ten/
`;
}

export function generateDesign(issue: GitHubIssue): string {
  const issueNum = String(issue.number);

  return `---
specId: issue-${issueNum}
issueNumber: ${issueNum}
---

# Design: ${issue.title}

## Overview

This document describes the technical approach for fixing the security vulnerability
reported in issue #${issueNum}.

## Affected Areas

The specific files and components to modify depend on the issue type. Use the
checklist in \`.kiro/steering/security-fix-patterns.md\` to identify the relevant code.

Common patterns for hb-frontend issues:

| Issue Type | Frontend Files | Backend Files |
|---|---|---|
| localStorage token | \`frontend/src/auth.ts\`, \`frontend/src/hooks/useAuth.ts\` | \`backend/app/routers/auth.py\` |
| SQL injection | — | \`backend/app/routers/search.py\`, \`backend/app/db.py\` |
| IDOR | — | \`backend/app/routers/users.py\` |
| CSRF | \`frontend/src/api.ts\` | \`backend/app/middleware.py\` |

## Fix Approach

1. **Identify** all instances of the vulnerable pattern using \`grep\` on the codebase
2. **Apply** the before→after replacement from the relevant section of \`security-fix-patterns.md\`
3. **Test** manually and with automated tests
4. **Review** the security checklist at the bottom of \`security-fix-patterns.md\`

## Security Rationale

Refer to the OWASP classification in the issue body and the guidance in
\`.kiro/steering/security-fix-patterns.md\` for the specific CWE reference and
fix rationale.

## Branch Naming

\`fix/issue-${issueNum}-<short-slug>\`

Example: \`fix/issue-${issueNum}-${slugify(issue.title)}\`

## PR Description Template

Use the template provided in \`powers/security-fix-power/skills/owasp-fix/SKILL.md\`
under "General PR Description Template".

## Testing Strategy

- **Unit tests:** Mock the affected service/function and assert secure behaviour
- **Integration tests:** Confirm the endpoint returns the correct HTTP status codes
  (401 for unauth, 403 for forbidden, 200 for authorised owner)
- **Regression:** All existing tests must still pass
`;
}

export function generateTasks(issue: GitHubIssue): string {
  const issueNum = String(issue.number);

  return `---
specId: issue-${issueNum}
issueNumber: ${issueNum}
---

# Tasks: ${issue.title}

## Pre-flight

- [ ] 1. Confirm \`GITHUB_TOKEN\` environment variable is set and has \`repo\`, \`issues\`, \`pull_requests\` scopes
- [ ] 2. Verify Docker is running (required for GitHub MCP server): \`docker info\`
- [ ] 3. Read the issue body in full: [#${issueNum}](${issue.html_url})

## Spec

- [ ] 4. Read \`.kiro/specs/issue-fix/requirements.md\` — understand acceptance criteria
- [ ] 5. Read \`.kiro/specs/issue-fix/design.md\` — identify files to change
- [ ] 6. Read \`.kiro/steering/security-fix-patterns.md\` — load OWASP fix guidance

## Implementation

- [ ] 7. Clone or navigate to a local copy of \`Designerpro13/hb-frontend\`
- [ ] 8. Run existing tests to establish a clean baseline: \`npm test\` (frontend) / \`pytest\` (backend)
- [ ] 9. Apply the fix following \`design.md\` and the security-fix-patterns guidance
- [ ] 10. Write new tests that verify the specific vulnerability is fixed
- [ ] 11. Run the full test suite and confirm it passes

## Git & PR

- [ ] 12. Create a branch: \`git checkout -b fix/issue-${issueNum}-<slug>\`
- [ ] 13. Stage and commit: \`git commit -m "fix: remediate security issue #${issueNum}"\`
- [ ] 14. Push the branch: \`git push -u origin fix/issue-${issueNum}-<slug>\`
- [ ] 15. Open a PR via GitHub MCP referencing issue #${issueNum}
- [ ] 16. Add a comment on issue #${issueNum} linking back to the PR

## Verification

- [ ] 17. Confirm the PR description includes a link to this spec
- [ ] 18. Confirm the vulnerability checklist in \`security-fix-patterns.md\` is all green
- [ ] 19. Confirm no \`localStorage\` token reads/writes remain (if applicable)
`;
}

// ---------------------------------------------------------------------------
// File writer
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const SPEC_DIR = join(PROJECT_ROOT, ".kiro", "specs", "issue-fix");

export async function writeSpec(files: SpecFiles): Promise<void> {
  await mkdir(SPEC_DIR, { recursive: true });

  const paths = {
    requirements: join(SPEC_DIR, "requirements.md"),
    design: join(SPEC_DIR, "design.md"),
    tasks: join(SPEC_DIR, "tasks.md"),
  } as const;

  await Promise.all([
    writeFile(paths.requirements, files.requirements, "utf-8"),
    writeFile(paths.design, files.design, "utf-8"),
    writeFile(paths.tasks, files.tasks, "utf-8"),
  ]);

  log(`Spec files written to ${SPEC_DIR}`);
  log(`  ✓ requirements.md`);
  log(`  ✓ design.md`);
  log(`  ✓ tasks.md`);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function generateSpec(issueNumber: number): Promise<SpecFiles> {
  const issue = await fetchIssue(issueNumber);

  const files: SpecFiles = {
    requirements: generateRequirements(issue),
    design: generateDesign(issue),
    tasks: generateTasks(issue),
  };

  await writeSpec(files);
  return files;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

// Only run when invoked directly (not when imported by tests)
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const issueArg = process.argv[2];
  const issueNumber = issueArg !== undefined ? parseInt(issueArg, 10) : NaN;

  if (!issueArg || isNaN(issueNumber) || issueNumber <= 0) {
    console.error("[getGITfixed] Usage: tsx src/spec-gen.ts <issue-number>");
    console.error("  Example: tsx src/spec-gen.ts 19");
    process.exit(1);
  }

  generateSpec(issueNumber).catch((err: unknown) => {
    console.error("[getGITfixed] Fatal error:", err);
    process.exit(1);
  });
}
