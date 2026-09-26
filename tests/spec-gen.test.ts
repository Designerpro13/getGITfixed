/**
 * tests/spec-gen.test.ts
 *
 * Unit tests for src/spec-gen.ts.
 * All external I/O (Octokit, filesystem) is mocked — no real HTTP calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GitHubIssue, SpecFiles } from "../src/spec-gen.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ISSUE: GitHubIssue = {
  number: 19,
  title: "Access token stored in localStorage",
  body:
    "The frontend stores the JWT access token in `localStorage`. " +
    "This is vulnerable to XSS attacks. The token should be stored in an httpOnly cookie.",
  html_url: "https://github.com/Designerpro13/hb-frontend/issues/19",
  labels: [{ name: "security" }, { name: "bug" }],
  user: { login: "reporter" },
  created_at: "2024-01-15T10:00:00Z",
};

const MOCK_ISSUE_NO_BODY: GitHubIssue = {
  ...MOCK_ISSUE,
  number: 13,
  title: "SQL injection in /api/search",
  body: null,
  labels: [{ name: "security" }],
};

// ---------------------------------------------------------------------------
// Mock @octokit/rest
// ---------------------------------------------------------------------------

const mockGetIssue = vi.fn();

vi.mock("@octokit/rest", () => {
  return {
    Octokit: vi.fn().mockImplementation(() => ({
      issues: {
        get: mockGetIssue,
      },
      request: vi.fn().mockResolvedValue({
        headers: { "x-oauth-scopes": "repo, issues" },
        data: { login: "testuser" },
      }),
    })),
  };
});

// ---------------------------------------------------------------------------
// Mock node:fs/promises
// ---------------------------------------------------------------------------

const mockWriteFile = vi.fn<(path: unknown, data: unknown, encoding: unknown) => Promise<void>>();
const mockMkdir = vi.fn<(path: unknown, opts: unknown) => Promise<void>>();

vi.mock("node:fs/promises", () => ({
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  access: vi.fn(),
  constants: { F_OK: 0 },
}));

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are set up)
// ---------------------------------------------------------------------------

const {
  fetchIssue,
  generateRequirements,
  generateDesign,
  generateTasks,
  writeSpec,
  generateSpec,
} = await import("../src/spec-gen.js");

// ---------------------------------------------------------------------------
// Tests: fetchIssue
// ---------------------------------------------------------------------------

describe("fetchIssue", () => {
  beforeEach(() => {
    process.env["GITHUB_TOKEN"] = "test-token-1234";
    mockGetIssue.mockResolvedValue({ data: { ...MOCK_ISSUE, user: { login: "reporter" }, labels: [{ name: "security" }, { name: "bug" }], body: MOCK_ISSUE.body } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env["GITHUB_TOKEN"];
  });

  it("calls Octokit with the correct owner, repo and issue number", async () => {
    await fetchIssue(19);
    expect(mockGetIssue).toHaveBeenCalledWith({
      owner: "Designerpro13",
      repo: "hb-frontend",
      issue_number: 19,
    });
  });

  it("returns a GitHubIssue with the expected fields", async () => {
    const issue = await fetchIssue(19);
    expect(issue.number).toBe(19);
    expect(issue.title).toBe("Access token stored in localStorage");
    expect(issue.html_url).toContain("issues/19");
    expect(issue.labels).toHaveLength(2);
    expect(issue.user?.login).toBe("reporter");
  });

  it("throws if GITHUB_TOKEN is not set", async () => {
    delete process.env["GITHUB_TOKEN"];
    await expect(fetchIssue(19)).rejects.toThrow(/GITHUB_TOKEN/);
  });

  it("handles a null issue body gracefully", async () => {
    mockGetIssue.mockResolvedValue({ data: { ...MOCK_ISSUE_NO_BODY, user: { login: "reporter" }, labels: [{ name: "security" }] } });
    const issue = await fetchIssue(13);
    expect(issue.body).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: generateRequirements
// ---------------------------------------------------------------------------

describe("generateRequirements", () => {
  it("includes the issue number in the output", () => {
    const md = generateRequirements(MOCK_ISSUE);
    expect(md).toContain("#19");
    expect(md).toContain("issue-19");
  });

  it("includes the issue title", () => {
    const md = generateRequirements(MOCK_ISSUE);
    expect(md).toContain("Access token stored in localStorage");
  });

  it("includes the issue body", () => {
    const md = generateRequirements(MOCK_ISSUE);
    expect(md).toContain("httpOnly cookie");
  });

  it("includes acceptance criteria section", () => {
    const md = generateRequirements(MOCK_ISSUE);
    expect(md).toContain("Acceptance Criteria");
    expect(md).toContain("AC-1");
    expect(md).toContain("AC-5");
  });

  it("includes the issue URL", () => {
    const md = generateRequirements(MOCK_ISSUE);
    expect(md).toContain(MOCK_ISSUE.html_url);
  });

  it("handles null body gracefully", () => {
    const md = generateRequirements(MOCK_ISSUE_NO_BODY);
    expect(md).toContain("No description provided");
  });

  it("includes all label names", () => {
    const md = generateRequirements(MOCK_ISSUE);
    expect(md).toContain("security");
    expect(md).toContain("bug");
  });
});

// ---------------------------------------------------------------------------
// Tests: generateDesign
// ---------------------------------------------------------------------------

describe("generateDesign", () => {
  it("includes the issue number", () => {
    const md = generateDesign(MOCK_ISSUE);
    expect(md).toContain("issue-19");
  });

  it("includes a branch naming section", () => {
    const md = generateDesign(MOCK_ISSUE);
    expect(md).toContain("fix/issue-19");
  });

  it("includes a reference to security-fix-patterns.md", () => {
    const md = generateDesign(MOCK_ISSUE);
    expect(md).toContain("security-fix-patterns.md");
  });

  it("includes a testing strategy section", () => {
    const md = generateDesign(MOCK_ISSUE);
    expect(md).toContain("Testing Strategy");
  });
});

// ---------------------------------------------------------------------------
// Tests: generateTasks
// ---------------------------------------------------------------------------

describe("generateTasks", () => {
  it("includes the issue number in task headings and links", () => {
    const md = generateTasks(MOCK_ISSUE);
    expect(md).toContain("#19");
    expect(md).toContain(MOCK_ISSUE.html_url);
  });

  it("has at least 15 numbered task items", () => {
    const md = generateTasks(MOCK_ISSUE);
    const taskMatches = md.match(/- \[ \] \d+\./g);
    expect(taskMatches).not.toBeNull();
    expect((taskMatches ?? []).length).toBeGreaterThanOrEqual(15);
  });

  it("includes a Pre-flight section", () => {
    const md = generateTasks(MOCK_ISSUE);
    expect(md).toContain("Pre-flight");
  });

  it("includes a Git & PR section", () => {
    const md = generateTasks(MOCK_ISSUE);
    expect(md).toContain("Git & PR");
  });

  it("mentions the branch name pattern", () => {
    const md = generateTasks(MOCK_ISSUE);
    expect(md).toContain("fix/issue-19");
  });
});

// ---------------------------------------------------------------------------
// Tests: writeSpec
// ---------------------------------------------------------------------------

describe("writeSpec", () => {
  beforeEach(() => {
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates the spec directory with recursive option", async () => {
    const files: SpecFiles = {
      requirements: "# req",
      design: "# design",
      tasks: "# tasks",
    };
    await writeSpec(files);
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining("issue-fix"),
      { recursive: true },
    );
  });

  it("writes all three spec files", async () => {
    const files: SpecFiles = {
      requirements: "# req content",
      design: "# design content",
      tasks: "# tasks content",
    };
    await writeSpec(files);
    expect(mockWriteFile).toHaveBeenCalledTimes(3);

    const writtenPaths = mockWriteFile.mock.calls.map((c) => String(c[0]));
    expect(writtenPaths.some((p) => p.endsWith("requirements.md"))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith("design.md"))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith("tasks.md"))).toBe(true);
  });

  it("writes the correct content to each file", async () => {
    const files: SpecFiles = {
      requirements: "req-content",
      design: "design-content",
      tasks: "tasks-content",
    };
    await writeSpec(files);

    const calls = mockWriteFile.mock.calls;
    const reqCall = calls.find((c) => String(c[0]).endsWith("requirements.md"));
    expect(reqCall?.[1]).toBe("req-content");
  });
});

// ---------------------------------------------------------------------------
// Tests: generateSpec (integration)
// ---------------------------------------------------------------------------

describe("generateSpec", () => {
  beforeEach(() => {
    process.env["GITHUB_TOKEN"] = "test-token";
    mockGetIssue.mockResolvedValue({
      data: {
        ...MOCK_ISSUE,
        user: { login: "reporter" },
        labels: [{ name: "security" }],
        body: MOCK_ISSUE.body,
      },
    });
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env["GITHUB_TOKEN"];
  });

  it("returns a SpecFiles object with all three fields populated", async () => {
    const result = await generateSpec(19);
    expect(result.requirements).toBeTruthy();
    expect(result.design).toBeTruthy();
    expect(result.tasks).toBeTruthy();
  });

  it("writes all three files to disk", async () => {
    await generateSpec(19);
    expect(mockWriteFile).toHaveBeenCalledTimes(3);
  });

  it("includes the issue number in the generated content", async () => {
    const result = await generateSpec(19);
    expect(result.requirements).toContain("19");
    expect(result.design).toContain("19");
    expect(result.tasks).toContain("19");
  });
});
