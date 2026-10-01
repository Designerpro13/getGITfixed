/**
 * verify-mcp.ts
 *
 * Verifies that the GitHub MCP connection is working by listing open issues
 * from Designerpro13/hb-frontend using the Octokit REST client (same token
 * that the Docker MCP server uses).
 *
 * This script does NOT use the Docker MCP server directly — it hits the
 * GitHub API with the same token to confirm connectivity and scope before
 * you run the full pipeline.
 *
 * Usage: tsx src/verify-mcp.ts
 */

import { pathToFileURL } from "node:url";
import { Octokit } from "@octokit/rest";

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
// Verification
// ---------------------------------------------------------------------------

export async function verifyMcp(
  owner = "Designerpro13",
  repo = "hb-frontend",
): Promise<void> {
  const token = getEnv("GITHUB_TOKEN");

  // Mask the token in logs — show only first 4 chars
  const masked = `${token.slice(0, 4)}${"*".repeat(Math.max(0, token.length - 4))}`;
  log(`Using GITHUB_TOKEN: ${masked}`);

  const octokit = new Octokit({ auth: token });

  // --- Check token scopes ---
  log("Checking token scopes…");
  const { headers } = await octokit.request("GET /user");
  const scopes = (headers["x-oauth-scopes"] as string | undefined) ?? "(none returned)";
  log(`Token scopes: ${scopes}`);

  const requiredScopes = ["repo", "issues"];
  const missingScopes = requiredScopes.filter(
    (s) => !scopes.includes(s) && !scopes.includes("repo"),
  );

  if (missingScopes.length > 0) {
    console.warn(
      `[getGITfixed] Warning: token may be missing scopes: ${missingScopes.join(", ")}`,
    );
  }

  // --- List open issues ---
  log(`Fetching open issues from ${owner}/${repo}…`);

  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: "open",
    per_page: 30,
  });

  if (issues.length === 0) {
    log("No open issues found — the repo may be private or the token lacks access.");
    return;
  }

  log(`Found ${issues.length} open issue(s):\n`);

  for (const issue of issues) {
    const labels = issue.labels
      .map((l) => (typeof l === "string" ? l : (l.name ?? "")))
      .filter(Boolean)
      .join(", ");

    console.info(
      `  #${String(issue.number).padStart(3, " ")}  ${issue.title}` +
        (labels ? `  [${labels}]` : ""),
    );
  }

  console.info("");
  log("MCP connectivity verified. The pipeline is ready to run.");
  log(`Run: ./run.sh <issue-number> (e.g. ./run.sh 19)`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  verifyMcp().catch((err: unknown) => {
    console.error("[getGITfixed] Verification failed:", err);
    process.exit(1);
  });
}
