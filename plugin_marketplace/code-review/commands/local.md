---
description: "Perform a thorough code review on local changes and return findings as a summary (no comments posted)"
model: "code-review"
---

**IMPORTANT: This is a dry-run review. Do NOT post any comments to GitHub. Return all findings as a summary to the user.**

Tooling constraints:
- Allowed tools: `launch-process`, `view`
- Disallowed tools: `github-api`

## Step 1: Gather Changes to Review

Run the following git commands to gather local changes:

1. Run `git fetch origin main` to ensure accurate comparison
2. Run `git diff origin/main...HEAD` to get the full diff of committed changes
3. Run `git diff --stat origin/main...HEAD` to get file statistics
4. Run `git diff --name-only origin/main...HEAD` to list changed files
5. If there are uncommitted changes, include those as well:
   - **Staged changes:** `git diff --staged` (changes staged in the index vs HEAD)
   - **Unstaged changes:** `git diff` (working tree vs index)
   - Note: These diffs are relative to the current HEAD/index, not origin/main. They represent work-in-progress that hasn't been committed yet.

### Changes Summary Format

After gathering the data, organize it as follows:

**Proposed Changes Summary:**
- [One sentence describing what this change set does]
- **Files changed:** [count]
- **Additions:** [+lines] | **Deletions:** [-lines]

## Step 2: Check for Custom Guidelines

Look for custom code review guidelines in the repository:
- Check if `.augment/code_review_guidelines.yaml` exists in the repository root
- If the file doesn't exist or can't be read, skip this step and proceed without custom guidelines
- If found, read the file and identify areas and rules relevant to the changed files:
  - Match file paths from Step 1 against the `globs` patterns in each area
  - Collect the matching rules to apply during review
  - Do not apply custom guidelines to Augment internal files (`.augment/**/*.md`)

When referencing a custom guideline in your review findings, mention it using the format:
`(Guideline: <guideline_id>)`

## Step 3: Review the Changes

Analyze the diff and identify issues. Apply any custom guidelines loaded in Step 2. Focus on high confidence findings—bugs, security issues, logic errors. Skip low-severity issues unless they indicate a pattern.

## Step 4: Format the Review Summary

Present the review using this format:

```
## Local Changes Summary

Branch: [branch-name] | Base: origin/main | Commits: [N]
Files: [N] | +[additions] -[deletions]

[One sentence describing what this change set does]

## Review Findings

1. [file/path.ext]:[line(s)]

   Severity: [low|medium|high]
   [Description of issue and suggested fix]

2. [file/path.ext]:[line(s)]

   Severity: [low|medium|high]
   [Description of issue and suggested fix]
```

## Guidelines

- Be specific with file paths and line numbers
- Explain *why* something is problematic
- Skip style nitpicks if there are real bugs

**Do NOT post any comments to GitHub. Return findings as a summary only.**
