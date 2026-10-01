/**
 * pipeline.ts
 *
 * Orchestrates the full getGITfixed pipeline:
 *   1. Validate preconditions (GITHUB_TOKEN, kiro-cli presence)
 *   2. Generate spec files from the GitHub issue (spec-gen.ts)
 *   3. Invoke kiro-cli --no-interactive with pr-agent
 *
 * The kiro-cli step is the heavy lifter — it reads the generated spec,
 * implements the fix on hb-frontend, and opens the PR.
 *
 * Usage: tsx src/pipeline.ts <issue-number>
 */

import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { generateSpec } from "./spec-gen.js";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  issueNumber: number;
  owner?: string;
  repo?: string;
  dryRun?: boolean;
}

export interface PipelineResult {
  success: boolean;
  issueNumber: number;
  specGenerated: boolean;
  kiroCliExitCode: number | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string): void {
  console.info(`[getGITfixed] ${message}`);
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[getGITfixed] Required environment variable ${key} is not set.`,
    );
  }
  return value;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertKiroCli(): Promise<void> {
  try {
    await execFileAsync("kiro-cli", ["--version"]);
  } catch {
    throw new Error(
      "[getGITfixed] kiro-cli is not installed or not in PATH. " +
        "Install it with: npm install -g @kiro/cli",
    );
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function runPipeline(
  options: PipelineOptions,
): Promise<PipelineResult> {
  const { issueNumber, owner = "Designerpro13", repo = "hb-frontend" } =
    options;

  const result: PipelineResult = {
    success: false,
    issueNumber,
    specGenerated: false,
    kiroCliExitCode: null,
  };

  // --- Step 1: Validate environment ---
  log("Checking environment…");
  try {
    getEnv("GITHUB_TOKEN");
  } catch (err) {
    result.error = String(err);
    return result;
  }
  log("GITHUB_TOKEN present: true");

  // --- Step 2: Check kiro-cli availability ---
  if (!options.dryRun) {
    await assertKiroCli();
    log("kiro-cli found in PATH");
  }

  // --- Step 3: Generate spec files ---
  const issueNum = String(issueNumber);
  log(`Generating spec for issue #${issueNum} on ${owner}/${repo}…`);
  try {
    await generateSpec(issueNumber);
    result.specGenerated = true;
  } catch (err) {
    result.error = `Spec generation failed: ${String(err)}`;
    return result;
  }

  // --- Step 4: Verify spec files were written ---
  const specDir = join(PROJECT_ROOT, ".kiro", "specs", "issue-fix");
  const specFilesExist = await Promise.all([
    fileExists(join(specDir, "requirements.md")),
    fileExists(join(specDir, "design.md")),
    fileExists(join(specDir, "tasks.md")),
  ]);

  if (specFilesExist.some((e) => !e)) {
    result.error = "One or more spec files were not written. Aborting.";
    return result;
  }

  log("All three spec files confirmed on disk");

  if (options.dryRun) {
    log("Dry run — skipping kiro-cli invocation");
    result.success = true;
    return result;
  }

  // --- Step 5: Invoke kiro-cli --no-interactive ---
  const prompt =
    `Issue #${issueNum} in ${owner}/${repo} has been specced in .kiro/specs/issue-fix/. ` +
    `Read the spec, clone the repo, implement the fix following the steering and ` +
    `security-fix power guidance, run the test suite, create a branch named ` +
    `fix/issue-${issueNum}, push it, and open a PR referencing issue #${issueNum}.`;

  log("Invoking kiro-cli…");
  log(`Prompt: ${prompt}`);

  try {
    const { stdout, stderr } = await execFileAsync(
      "kiro-cli",
      [
        "chat",
        "--no-interactive",
        "--agent",
        "pr-agent",
        "--trust-tools=read,write,shell,grep",
        "--output-format",
        "stream-json",
        prompt,
      ],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        // Allow up to 30 minutes for the agent to complete the full pipeline
        timeout: 30 * 60 * 1000,
      },
    );

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);

    result.kiroCliExitCode = 0;
    result.success = true;
    log("kiro-cli completed successfully");
  } catch (err: unknown) {
    const execErr = err as NodeJS.ErrnoException & {
      code?: number;
      stdout?: string;
      stderr?: string;
    };

    result.kiroCliExitCode = execErr.code ?? 1;

    if (execErr.stdout) process.stdout.write(execErr.stdout);
    if (execErr.stderr) process.stderr.write(execErr.stderr);

    result.error = `kiro-cli exited with code ${result.kiroCliExitCode}: ${execErr.message}`;
    log(`kiro-cli failed: ${result.error}`);
    // Non-zero exit is still logged but we don't panic — the PR may have been opened
  }

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const issueArg = process.argv[2];
  const issueNumber = issueArg !== undefined ? parseInt(issueArg, 10) : NaN;

  if (!issueArg || isNaN(issueNumber) || issueNumber <= 0) {
    console.error("[getGITfixed] Usage: tsx src/pipeline.ts <issue-number>");
    process.exit(1);
  }

  runPipeline({ issueNumber }).then((result) => {
    if (result.success) {
      log(`Pipeline completed successfully for issue #${String(issueNumber)}`);
    } else {
      console.error(
        `[getGITfixed] Pipeline failed: ${result.error ?? "unknown error"}`,
      );
      process.exit(1);
    }
  }).catch((err: unknown) => {
    console.error("[getGITfixed] Fatal error:", err);
    process.exit(1);
  });
}
