import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getSanitizedBranch } from "./git";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe("getSanitizedBranch", () => {
  beforeEach(() => {
    delete process.env.CDK_BRANCH_OVERWRITE;
  });

  afterEach(() => {
    delete process.env.CDK_BRANCH_OVERWRITE;
    vi.clearAllMocks();
  });

  describe("main branch handling", () => {
    it("returns empty string on main branch by default", () => {
      process.env.CDK_BRANCH_OVERWRITE = "main";
      expect(getSanitizedBranch()).toBe("");
    });

    it("returns 'main' when includeMain is true", () => {
      process.env.CDK_BRANCH_OVERWRITE = "main";
      expect(getSanitizedBranch(true)).toBe("main");
    });
  });

  describe("sanitization", () => {
    it("lowercases the branch name", () => {
      process.env.CDK_BRANCH_OVERWRITE = "Feature-ABC";
      expect(getSanitizedBranch()).toBe("feature-abc");
    });

    it("replaces non-alphanumeric characters with hyphens", () => {
      process.env.CDK_BRANCH_OVERWRITE = "feat/my_branch.1";
      expect(getSanitizedBranch()).toBe("feat-my-branch-1");
    });

    it("collapses consecutive hyphens into one", () => {
      process.env.CDK_BRANCH_OVERWRITE = "feat//double--slash";
      expect(getSanitizedBranch()).toBe("feat-double-slash");
    });

    it("strips leading and trailing hyphens", () => {
      process.env.CDK_BRANCH_OVERWRITE = "/leading-and-trailing/";
      expect(getSanitizedBranch()).toBe("leading-and-trailing");
    });

    it("truncates to 20 characters", () => {
      process.env.CDK_BRANCH_OVERWRITE = "this-is-a-very-long-branch-name";
      const result = getSanitizedBranch();
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it("removes trailing hyphen created by truncation", () => {
      // "feat-1234567890123456-x" truncates at position 20 with a trailing "-"
      process.env.CDK_BRANCH_OVERWRITE = "feat-1234567890123456-x";
      const result = getSanitizedBranch();
      expect(result.endsWith("-")).toBe(false);
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe("git command integration", () => {
    it("returns the sanitized branch name from git", () => {
      mockExecSync.mockReturnValue("my-feature\n");
      expect(getSanitizedBranch()).toBe("my-feature");
    });

    it("uses CDK_BRANCH_OVERWRITE env variable instead of running git", () => {
      process.env.CDK_BRANCH_OVERWRITE = "my-feature";
      expect(getSanitizedBranch()).toBe("my-feature");
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns empty string when git command throws", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("git not found");
      });
      expect(getSanitizedBranch()).toBe("");
    });
  });
});
