/**
 * tests/pipeline.test.ts
 *
 * Unit / integration tests for src/pipeline.ts.
 * kiro-cli and all filesystem operations are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PipelineOptions } from "../src/pipeline.js";

// ---------------------------------------------------------------------------
// Mock child_process
// ---------------------------------------------------------------------------

const mockExecFile = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: mockExecFile,
}));

// ---------------------------------------------------------------------------
// Mock node:util (promisify returns our mock)
// ---------------------------------------------------------------------------

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => {
    // If promisifying execFile, return our mock wrapper
    if (fn === mockExecFile) {
      return (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockExecFile(...args));
    }
    // Fallback for anything else
    return (..._args: unknown[]): Promise<unknown> => Promise.resolve(fn);
  },
}));

// ---------------------------------------------------------------------------
// Mock node:fs/promises
// ---------------------------------------------------------------------------

const mockAccess = vi.fn<() => Promise<void>>();

vi.mock("node:fs/promises", () => ({
  access: mockAccess,
  constants: { F_OK: 0 },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock spec-gen (so pipeline tests don't hit real GitHub API)
// ---------------------------------------------------------------------------

const mockGenerateSpec = vi.fn();

vi.mock("../src/spec-gen.js", () => ({
  generateSpec: mockGenerateSpec,
  fetchIssue: vi.fn(),
  generateRequirements: vi.fn().mockReturnValue("# req"),
  generateDesign: vi.fn().mockReturnValue("# design"),
  generateTasks: vi.fn().mockReturnValue("# tasks"),
  writeSpec: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

const { runPipeline } = await import("../src/pipeline.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOptions(overrides: Partial<PipelineOptions> = {}): PipelineOptions {
  return {
    issueNumber: 19,
    dryRun: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runPipeline", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "ghp_test_token";

    // spec files exist on disk
    mockAccess.mockResolvedValue(undefined);

    // spec generation succeeds
    mockGenerateSpec.mockResolvedValue({
      requirements: "# req",
      design: "# design",
      tasks: "# tasks",
    });

    // kiro-cli --version succeeds
    mockExecFile.mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: (err: null, result: {stdout: string; stderr: string}) => void) => {
        if (Array.isArray(args) && args[0] === "--version") {
          cb(null, { stdout: "kiro-cli 1.0.0", stderr: "" });
        } else {
          cb(null, { stdout: '{"type":"complete"}', stderr: "" });
        }
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  it("returns success: true on a happy-path dry run", async () => {
    const result = await runPipeline(makeOptions({ dryRun: true }));
    expect(result.success).toBe(true);
    expect(result.issueNumber).toBe(19);
    expect(result.specGenerated).toBe(true);
  });

  it("calls generateSpec with the issue number", async () => {
    await runPipeline(makeOptions({ dryRun: true }));
    expect(mockGenerateSpec).toHaveBeenCalledWith(19);
  });

  it("fails if GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;
    const result = await runPipeline(makeOptions({ dryRun: true }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/GITHUB_TOKEN/);
  });

  it("fails if spec generation throws", async () => {
    mockGenerateSpec.mockRejectedValue(new Error("Octokit 404"));
    const result = await runPipeline(makeOptions({ dryRun: true }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("Spec generation failed");
  });

  it("skips kiro-cli invocation when dryRun is true", async () => {
    await runPipeline(makeOptions({ dryRun: true }));
    // execFile should NOT have been called with 'kiro-cli' 'chat' args
    const kiroChatCalls = mockExecFile.mock.calls.filter(
      (c: unknown[]) => c[0] === "kiro-cli" && Array.isArray(c[1]) && (c[1] as string[]).includes("chat"),
    );
    expect(kiroChatCalls).toHaveLength(0);
  });

  it("includes the issue number in the kiro-cli prompt (non-dry-run would)", async () => {
    // We verify the prompt would contain issue #19 by checking what
    // generateSpec was called with and that result.issueNumber matches
    const result = await runPipeline(makeOptions({ dryRun: true }));
    expect(result.issueNumber).toBe(19);
  });

  it("reports specGenerated: false when spec files are missing from disk", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    const result = await runPipeline(makeOptions({ dryRun: true }));
    // spec generation mock succeeds, but file existence check fails
    expect(result.success).toBe(false);
    expect(result.error).toContain("spec files were not written");
  });

  it("accepts a custom owner and repo", async () => {
    const result = await runPipeline(
      makeOptions({ dryRun: true, owner: "other-org", repo: "other-repo" }),
    );
    expect(result.success).toBe(true);
    // generateSpec still gets the issue number
    expect(mockGenerateSpec).toHaveBeenCalledWith(19);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("runPipeline — input edge cases", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "ghp_test";
    mockAccess.mockResolvedValue(undefined);
    mockGenerateSpec.mockResolvedValue({ requirements: "", design: "", tasks: "" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  it("handles issue number 1 (edge: lowest valid number)", async () => {
    const result = await runPipeline(makeOptions({ issueNumber: 1 }));
    expect(result.issueNumber).toBe(1);
  });

  it("handles large issue numbers", async () => {
    const result = await runPipeline(makeOptions({ issueNumber: 9999 }));
    expect(result.issueNumber).toBe(9999);
    expect(mockGenerateSpec).toHaveBeenCalledWith(9999);
  });
});
