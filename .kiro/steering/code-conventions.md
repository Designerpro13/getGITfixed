---
inclusion: always
---

# Code Conventions

## File Naming

- Source files: `kebab-case.ts` (e.g., `spec-gen.ts`, `verify-mcp.ts`)
- Test files: `kebab-case.test.ts` matching the source file name
- Script files: `kebab-case.sh`

## Module Structure

Every `src/` module exports a set of named functions — no default exports except where the framework requires it.

```
src/
  spec-gen.ts     — fetchIssue(), generateRequirements(), generateDesign(), generateTasks(), writeSpec()
  pipeline.ts     — runPipeline()
  verify-mcp.ts   — verifyMcp()
```

## Async / Error Handling

```typescript
// ✅ Good — explicit return type, await, typed error
async function fetchIssue(issueNumber: number): Promise<GitHubIssue> {
  const response = await octokit.issues.get({ owner, repo, issue_number: issueNumber });
  return response.data;
}

// ❌ Bad — callback, no return type, swallowed error
function fetchIssue(n, cb) {
  octokit.issues.get({ ... }, (err, data) => cb(data));
}
```

- Always `await` Promises; never fire-and-forget unless annotated with a comment explaining why
- Wrap external I/O (GitHub API, filesystem) in try/catch and rethrow with context:

```typescript
try {
  await writeFile(path, content);
} catch (err) {
  throw new Error(`Failed to write spec file at ${path}: ${String(err)}`);
}
```

## Logging

- Use `console.info` for normal progress messages (prefixed with `[kiro-pr-bot]`)
- Use `console.warn` for non-fatal issues
- Use `console.error` for fatal errors before `process.exit(1)`
- Never log secrets — log key names only (e.g., "GITHUB_TOKEN present: true")

## Environment Variables

- Read from `process.env`; fail fast with a clear error if a required variable is missing
- Centralise env reads in a single `getEnv(key: string): string` helper

## Imports

- Always use `.js` extension in import paths (required for ESM + NodeNext)
- Group imports: Node built-ins → third-party → local

```typescript
import { writeFile, mkdir } from "node:fs/promises";
import { Octokit } from "@octokit/rest";
import { generateRequirements } from "./spec-gen.js";
```
